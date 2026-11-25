// Health Chair firmware
// ESP32-S3 + FSR x6 + MPU6050 (GY-521) -> Edge Impulse (จำแนกท่านั่ง) -> ThingsBoard (MQTT)
//
// ประหยัดแบต (LOW_POWER 1):
//   ไม่มีคนนั่ง  -> MPU6050 หลับ, Wi-Fi ปิด, ESP32 light sleep ตื่นมาอ่าน FSR ทุก 1 วินาที
//   มีคนนั่ง     -> อ่านเซนเซอร์ 20 Hz + จำแนกท่า + เตือน
//                  REALTIME_WHILE_SEATED 1: ต่อ Wi-Fi ค้างไว้ (modem sleep) เช็กทุก 1 วินาที
//                                           ส่งเฉพาะค่าที่เปลี่ยน และส่งครบทุกค่าทุก 60 วินาที
//                  REALTIME_WHILE_SEATED 0: เก็บค่าทุก 10 วินาที แล้วเปิด Wi-Fi ส่งรวดเดียวทุก 60 วินาที
//   แบตต่ำกว่า VBAT_CUTOFF_V -> deep sleep ตื่นมาเช็กทุก 1 ชั่วโมงจนกว่าจะชาร์จ
#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#define ARDUINOJSON_USE_LONG_LONG 1  // เวลาแบบ ms ต้องใช้ตัวเลข 64 บิต
#include <ArduinoJson.h>
#include <Wire.h>
#include <MPU6050_light.h>
#include <sys/time.h>
#include <time.h>
#include "esp_sleep.h"
#include "config.h"

// ถ้าวาง library จาก Edge Impulse ไว้ใน lib/ แล้ว จะใช้โมเดล AI
// ถ้าชื่อโปรเจกต์ใน Edge Impulse ไม่ใช่ "Health Chair" ให้แก้ชื่อไฟล์ .h สองบรรทัดนี้
#if __has_include(<health_chair_inferencing.h>)
#include <health_chair_inferencing.h>
#define HAVE_EI 1
#elif __has_include(<Health_Chair_inferencing.h>)
#include <Health_Chair_inferencing.h>
#define HAVE_EI 1
#else
#define HAVE_EI 0
#endif

static const char *FW_VERSION = "1.4.0";
static const int N_AXES = 9;  // fsr1..fsr6, accX, accY, accZ (ลำดับเดียวกับตอนเก็บข้อมูล)

// บางบอร์ดไม่มี LED (ขา = -1) ให้ข้ามไป
static inline void setLed(int pin, int v) { if (pin >= 0) digitalWrite(pin, v); }

// buzzer: active = HIGH ค้าง, passive (BUZZER_FREQ > 0) = PWM 50% ที่ความถี่นั้น
#define BUZZER_CH 0
static void buzzer(bool on) {
#if BUZZER_FREQ > 0
  ledcWrite(BUZZER_CH, on ? 128 : 0);
#else
  digitalWrite(BUZZER_PIN, on ? HIGH : LOW);
#endif
}

MPU6050 mpu(Wire);
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
bool mpuOk = false;

// ---------- ค่าเซนเซอร์ล่าสุด ----------
float fsr[6];            // 0.0 - 1.0 (สัดส่วนของ 3.3 V)
float accX, accY, accZ;  // g
float baseAcc[3] = {0, 0, 1};  // ทิศแรงโน้มถ่วงตอนเปิดเครื่อง (พนักพิงตั้งปกติ)
float backrestDeg = 0;   // พนักพิงเอนจากตอนเปิดเครื่องกี่องศา

// ---------- สถานะท่านั่ง ----------
String posture = "empty";
float confidence = 0;
float anomaly = 0;
bool occupied = false;

// ---------- ตั้งค่าที่แก้จาก ThingsBoard (shared attributes) ----------
int badPostureAlertSec = BAD_POSTURE_ALERT_SEC;
int sitLimitMin = SIT_LIMIT_MIN;
int uploadIntervalSec = UPLOAD_INTERVAL_SEC;
bool muted = false;
bool settingsReceived = false;

// ---------- ตัวจับเวลา ----------
enum Mode { IDLE, SEATED };
Mode mode = IDLE;
unsigned long sitStartMs = 0;       // เริ่มนั่งรอบนี้เมื่อไร
unsigned long lastSeatSeenMs = 0;   // เห็นแรงกดบนเบาะครั้งล่าสุด
unsigned long badStartMs = 0;       // เริ่มนั่งผิดท่าเมื่อไร (0 = ไม่ผิด)
unsigned long goodSinceMs = 0;      // กลับมานั่งท่าดีตั้งแต่เมื่อไร (0 = ยังไม่ได้กลับ)
unsigned long nextSample = 0;       // เวลาอ่านเซนเซอร์รอบถัดไป (20 Hz)
unsigned long lastPointMs = 0;      // โหมดส่งเป็นช่วง: เก็บจุดล่าสุดเมื่อไร
unsigned long lastRecordMs = 0;     // โหมด realtime: เก็บจุดล่าสุดเมื่อไร
String lastRecPosture = "";
unsigned long lastUploadMs = 0;     // ส่งข้อมูลสำเร็จครั้งล่าสุด
unsigned long lastUploadTryMs = 0;  // ลองส่งครั้งล่าสุด
uint8_t uploadFails = 0;            // ส่งไม่สำเร็จติดกันกี่ครั้ง
bool alertPending = false;          // โหมดส่งเป็นช่วง: มีการเตือนใหม่ที่ยังไม่ได้ส่ง
unsigned long wifiRetryAtMs = 0;    // ต่อ Wi-Fi ไม่ติด: ห้ามลองใหม่ก่อนเวลานี้
uint8_t wifiFails = 0;
unsigned long lastMqttTryMs = 0;    // ลองต่อ ThingsBoard ครั้งล่าสุด
unsigned long mqttRetryGapMs = 5000;
unsigned long lastPublishMs = 0;
enum Alert : uint8_t { ALERT_NONE, ALERT_BAD_POSTURE, ALERT_SIT_TOO_LONG };
Alert alertType = ALERT_NONE;
const char *ALERT_NAMES[] = {"none", "bad_posture", "sit_too_long"};

// ---------- ข้อมูลที่รอส่ง ----------
struct Point {
  unsigned long atMs;  // millis() ตอนเก็บ (แปลงเป็นเวลาจริงตอนส่ง)
  char posture[16];
  float confidence, anomaly, backrestDeg, vbat;
  bool occupied, bad;
  uint16_t badSec, sitMin;
  uint8_t alert;
  uint8_t fsrPct[6];
};
static const int MAX_POINTS = 600;  // เผื่อ Wi-Fi ล่ม: 10 นาทีที่ 1 วินาที/จุด หรือ 100 นาทีที่ 10 วินาที/จุด
static Point points[MAX_POINTS];
static int nPoints = 0;

// ======================================================
//  อ่านเซนเซอร์
// ======================================================
void readFsr() {
  for (int i = 0; i < 6; i++) {
    fsr[i] = analogReadMilliVolts(FSR_PINS[i]) / 3300.0f;
    if (fsr[i] > 1.0f) fsr[i] = 1.0f;
  }
}

void readSensors() {
  readFsr();
  if (mpuOk) {
    mpu.update();
    accX = mpu.getAccX();
    accY = mpu.getAccY();
    accZ = mpu.getAccZ();
    // มุมระหว่างทิศแรงโน้มถ่วงตอนนี้กับตอนเปิดเครื่อง (ไม่ขึ้นกับว่าติดโมดูลหันทางไหน)
    float dot = accX * baseAcc[0] + accY * baseAcc[1] + accZ * baseAcc[2];
    float n1 = sqrtf(accX * accX + accY * accY + accZ * accZ);
    float n2 = sqrtf(baseAcc[0] * baseAcc[0] + baseAcc[1] * baseAcc[1] + baseAcc[2] * baseAcc[2]);
    if (n1 > 0.1f && n2 > 0.1f) backrestDeg = acosf(constrain(dot / (n1 * n2), -1.0f, 1.0f)) * 57.2958f;
  } else {
    accX = accY = accZ = 0;
  }
}

float readBatteryV() {
  uint32_t mv = 0;
  for (int i = 0; i < 8; i++) mv += analogReadMilliVolts(VBAT_PIN);
  return (mv / 8.0f) / 1000.0f * VBAT_DIVIDER;
}

int batteryPercent(float v) {
  float p = (v - VBAT_EMPTY_V) / (VBAT_FULL_V - VBAT_EMPTY_V) * 100.0f;
  return constrain((int)p, 0, 100);
}

float seatTotal() { return fsr[0] + fsr[1] + fsr[2] + fsr[3]; }

// MPU6050: ใช้แค่ accelerometer ปิด gyro ไว้ (เหลือ ~0.5 mA แทน ~4 mA) ไม่มีคนนั่งสั่งหลับ (~5 uA)
void mpuWrite(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}
void mpuSleep() { if (mpuOk) mpuWrite(0x6B, 0x40); }
void mpuWake() {
  if (!mpuOk) return;
  mpuWrite(0x6B, 0x00);  // ตื่น ใช้นาฬิกาภายใน 8 MHz (ปิด gyro แล้วห้ามใช้นาฬิกาจาก gyro)
  mpuWrite(0x6C, 0x07);  // gyro X/Y/Z พัก (standby) เหลือ accelerometer ทำงาน
  delay(50);
  mpu.update();
}

// ======================================================
//  จำแนกท่านั่ง
// ======================================================
bool isBadPosture(const String &p) {
  return p != "upright" && p != "empty" && p != "unknown";
}

// ใช้ตอนยังไม่มีโมเดล Edge Impulse (ค่าเกณฑ์ต้องปรับตามเก้าอี้จริง)
void classifyByRules() {
  float seat = seatTotal();
  float left = fsr[0] + fsr[2], right = fsr[1] + fsr[3];
  float front = fsr[0] + fsr[1], rear = fsr[2] + fsr[3];
  float back = fsr[4] + fsr[5];

  confidence = 1.0f;
  anomaly = 0;
  if (seat < SEAT_ON_THRESHOLD)                        posture = "empty";
  else if ((left - right) / seat > 0.35f)              posture = "lean_left";
  else if ((right - left) / seat > 0.35f)              posture = "lean_right";
  else if (back < 0.05f && front > rear * 2.0f)        posture = "perch";
  else if (back < 0.05f)                               posture = "lean_forward";
  else if (backrestDeg > 12.0f || fsr[4] < 0.03f)      posture = "lean_back";
  else                                                 posture = "upright";
}

#if HAVE_EI
static_assert(EI_CLASSIFIER_RAW_SAMPLES_PER_FRAME == N_AXES,
              "จำนวนแกนในโมเดล Edge Impulse ต้องเป็น 9 (fsr1-6, accX-Z)");

// บัฟเฟอร์เลื่อน (sliding window) เก็บข้อมูลย้อนหลังเท่าขนาด window ของโมเดล
static float eiBuffer[EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE];
static int eiFilled = 0;      // เติมไปแล้วกี่ค่า
static int newSamples = 0;    // ได้ข้อมูลใหม่กี่ชุดตั้งแต่ทำนายครั้งก่อน
static const int INFER_EVERY = SAMPLE_HZ / 2;  // ทำนายทุก 0.5 วินาที

void eiReset() { eiFilled = 0; newSamples = 0; }

void pushSample() {
  const float s[N_AXES] = {fsr[0], fsr[1], fsr[2], fsr[3], fsr[4], fsr[5], accX, accY, accZ};
  if (eiFilled < EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE) {
    memcpy(&eiBuffer[eiFilled], s, sizeof(s));
    eiFilled += N_AXES;
  } else {
    memmove(eiBuffer, eiBuffer + N_AXES, (EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE - N_AXES) * sizeof(float));
    memcpy(&eiBuffer[EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE - N_AXES], s, sizeof(s));
  }
  newSamples++;
}

bool classifyByModel() {
  if (eiFilled < EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE || newSamples < INFER_EVERY) return false;
  newSamples = 0;

  signal_t signal;
  if (numpy::signal_from_buffer(eiBuffer, EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE, &signal) != 0) return false;
  ei_impulse_result_t result = {};
  if (run_classifier(&signal, &result, false) != EI_IMPULSE_OK) return false;

  int best = 0;
  for (int i = 1; i < EI_CLASSIFIER_LABEL_COUNT; i++)
    if (result.classification[i].value > result.classification[best].value) best = i;
  confidence = result.classification[best].value;
  posture = result.classification[best].label;
#if EI_CLASSIFIER_HAS_ANOMALY
  anomaly = result.anomaly;
#endif
  if (confidence < MIN_CONFIDENCE || anomaly > ANOMALY_THRESHOLD) posture = "unknown";

  // แสดงผลทาง Serial ทุกครั้งที่ทำนายเสร็จ
  Serial.printf("%s posture: %-12s |", isBadPosture(posture) ? "[BAD]" : "[OK] ", posture.c_str());
  for (int i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++)
    Serial.printf(" %s=%.3f", result.classification[i].label, result.classification[i].value);
  Serial.printf(" anomaly=%.3f (dsp %d ms, nn %d ms)\n", anomaly, result.timing.dsp, result.timing.classification);
  return true;
}
#else
void eiReset() {}
#endif

void classify() {
#if HAVE_EI
  pushSample();
  classifyByModel();
  // ไม่มีแรงกดบนเบาะ = เก้าอี้ว่างแน่นอน ไม่ต้องเชื่อโมเดล (กันโมเดลทายผิดตอนเพิ่งลุก)
  if (seatTotal() < SEAT_ON_THRESHOLD) {
    posture = "empty";
    confidence = 1.0f;
    anomaly = 0;
  }
#else
  // ท่าใหม่ต้องคงอยู่ 0.5 วินาทีจึงเปลี่ยนตาม (กันค่า FSR แกว่งแล้วท่าสลับไปมา)
  static String candidate = "";
  static int sameCount = 0;
  String shown = posture;
  classifyByRules();
  if (posture == candidate) sameCount++;
  else { candidate = posture; sameCount = 1; }
  if (sameCount < SAMPLE_HZ / 2 && posture != "empty") posture = shown;

  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 1000) {
    lastPrint = millis();
    Serial.printf("%s posture: %-12s | seat=%.2f back=%.2f backrest=%.1f deg\n",
                  isBadPosture(posture) ? "[BAD]" : "[OK] ", posture.c_str(),
                  seatTotal(), fsr[4] + fsr[5], backrestDeg);
  }
#endif
}

// ======================================================
//  การแจ้งเตือน (LED + buzzer)
// ======================================================
// คืนค่า true ถ้าเพิ่งเริ่มเตือนรอบนี้
bool updateTimersAndAlerts() {
  unsigned long now = millis();
  occupied = posture != "empty";

  // นับเวลานั่งผิดท่า: ต้องกลับมานั่งท่าดีต่อเนื่อง 3 วินาทีจึงเริ่มนับใหม่ (กันท่าแกว่งไปมาแล้วไม่เคยเตือน)
  // "unknown" (โมเดลไม่แน่ใจ) ไม่นับว่าผิดหรือถูก
  if (isBadPosture(posture)) {
    if (badStartMs == 0) badStartMs = now;
    goodSinceMs = 0;
  } else if (posture != "unknown") {
    if (goodSinceMs == 0) goodSinceMs = now;
    if (now - goodSinceMs >= 3000) badStartMs = 0;
  }

  bool badAlert = badStartMs && goodSinceMs == 0 && now - badStartMs > badPostureAlertSec * 1000UL;
  bool sitAlert = occupied && sitStartMs && now - sitStartMs > sitLimitMin * 60000UL;
  Alert prev = alertType;
  alertType = badAlert ? ALERT_BAD_POSTURE : sitAlert ? ALERT_SIT_TOO_LONG : ALERT_NONE;

  // นั่งผิดท่า: บี๊บสั้นทุก 1 วินาที / นั่งนาน: บี๊บยาวทุก 5 วินาที
  bool beep = false;
  if (badAlert) beep = (now % 1000) < 150;
  else if (sitAlert) beep = (now % 5000) < 600;
  buzzer(beep && !muted);
  setLed(LED_ALERT, alertType != ALERT_NONE ? HIGH : LOW);
  return alertType != ALERT_NONE && alertType != prev;
}

uint16_t sitMinutes() { return sitStartMs ? (millis() - sitStartMs) / 60000UL : 0; }
uint16_t badSeconds() { return badStartMs ? (millis() - badStartMs) / 1000UL : 0; }

// ======================================================
//  เก็บข้อมูลไว้ในเครื่องก่อนส่ง
// ======================================================
void recordPoint() {
  if (nPoints == MAX_POINTS) {  // เต็มแล้ว ทิ้งจุดเก่าสุด
    memmove(points, points + 1, (MAX_POINTS - 1) * sizeof(Point));
    nPoints--;
  }
  Point &p = points[nPoints++];
  p.atMs = millis();
  strlcpy(p.posture, posture.c_str(), sizeof(p.posture));
  p.confidence = confidence;
  p.anomaly = anomaly;
  p.backrestDeg = backrestDeg;
  p.vbat = readBatteryV();
  p.occupied = occupied;
  p.bad = isBadPosture(posture);
  p.badSec = badSeconds();
  p.sitMin = sitMinutes();
  p.alert = alertType;
  for (int i = 0; i < 6; i++) p.fsrPct[i] = (uint8_t)roundf(fsr[i] * 100);
}

// เวลาจริง (ms ตั้งแต่ 1970) ของจุดที่เก็บไว้ หรือ 0 ถ้ายังไม่ได้ซิงก์เวลา
int64_t pointEpochMs(const Point &p) {
  struct timeval tv;
  gettimeofday(&tv, nullptr);
  if (tv.tv_sec < 1700000000) return 0;
  int64_t nowMs = (int64_t)tv.tv_sec * 1000 + tv.tv_usec / 1000;
  return nowMs - (int64_t)(millis() - p.atMs);
}

// ======================================================
//  Wi-Fi + ThingsBoard
// ======================================================
void applySettings(JsonObjectConst s) {
  // is<float>() รับได้ทั้ง 45 และ 45.0 (แล้วแต่ว่าตั้งค่าบน dashboard เป็น integer หรือ double)
  if (s["muted"].is<bool>()) muted = s["muted"];
  if (s["sit_limit_min"].is<float>()) sitLimitMin = constrain(s["sit_limit_min"].as<int>(), 1, 240);
  if (s["bad_posture_alert_sec"].is<float>()) badPostureAlertSec = constrain(s["bad_posture_alert_sec"].as<int>(), 3, 600);
  if (s["upload_interval_sec"].is<float>()) uploadIntervalSec = constrain(s["upload_interval_sec"].as<int>(), 10, 3600);
  Serial.printf("Settings: muted=%d sit_limit_min=%d bad_posture_alert_sec=%d upload_interval_sec=%d\n",
                muted, sitLimitMin, badPostureAlertSec, uploadIntervalSec);
}

void onMqttMessage(char *topic, byte *payload, unsigned int len) {
  JsonDocument doc;
  if (deserializeJson(doc, payload, len)) return;
  String t(topic);
  if (t == "v1/devices/me/attributes/response/1") {  // คำตอบตอนขอค่าตั้ง
    applySettings(doc["shared"].as<JsonObjectConst>());
    settingsReceived = true;
  } else if (t == "v1/devices/me/attributes") {      // มีคนแก้ค่าตั้งบน dashboard ขณะต่ออยู่
    applySettings(doc.as<JsonObjectConst>());
  }
}

void wifiStart() {  // สั่งต่อ Wi-Fi แล้วไปทำอย่างอื่นต่อ ไม่รอ
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(true);  // modem sleep: ต่อค้างไว้แต่ปิดวิทยุระหว่างรอ กินไฟน้อยกว่าเปิดวิทยุตลอดมาก
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

bool wifiUp() {  // แบบรอ ใช้ตอนเปิดเครื่องและตอนเก้าอี้ว่าง
  if (WiFi.status() == WL_CONNECTED) return true;
  wifiStart();
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 10000) delay(100);
  return WiFi.status() == WL_CONNECTED;
}

void radioOff() {
  if (mqtt.connected()) {
    unsigned long t0 = millis();
    while (millis() - t0 < 200) {  // ให้ข้อความสุดท้ายออกไปจริงก่อนตัดสัญญาณ
      mqtt.loop();
      delay(10);
    }
    mqtt.disconnect();
    delay(50);
  }
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
}

void wifiDown() {
  if (LOW_POWER) radioOff();  // โหมดไม่ประหยัด ต่อค้างไว้
}

bool timeSynced() { return time(nullptr) > 1700000000; }

void startTimeSync() {  // ซิงก์เวลาจาก NTP เบื้องหลัง (ครั้งเดียวพอ เวลาเดินต่อแม้ปิด Wi-Fi)
  static bool started = false;
  if (started || timeSynced()) return;
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  started = true;
}

// ต่อ ThingsBoard + ขอค่าตั้งจาก dashboard + ส่ง client attributes
bool mqttConnect() {
  if (mqtt.connected()) return true;
  lastMqttTryMs = millis();
  buzzer(false);  // การต่ออาจใช้เวลา 1-3 วินาที ห้ามให้ buzzer ค้าง
  if (!mqtt.connect("health-chair", TB_TOKEN, NULL)) {  // ThingsBoard ใช้ access token เป็น username
    // ต่อไม่ติด: รอนานขึ้นเรื่อย ๆ 10, 20, 40 ... สูงสุด 120 วินาที (เช่น token ผิด ไม่ต้องลองถี่)
    mqttRetryGapMs = mqttRetryGapMs >= 60000 ? 120000 : mqttRetryGapMs * 2;
    Serial.printf("ThingsBoard failed rc=%d (retry in %lu s)\n", mqtt.state(), mqttRetryGapMs / 1000);
    return false;
  }
  mqttRetryGapMs = 5000;
  mqtt.subscribe("v1/devices/me/attributes");
  mqtt.subscribe("v1/devices/me/attributes/response/+");
  settingsReceived = false;
  mqtt.publish("v1/devices/me/attributes/request/1",
               "{\"sharedKeys\":\"muted,sit_limit_min,bad_posture_alert_sec,upload_interval_sec\"}");

  JsonDocument attr;  // client attributes
  attr["firmware"] = FW_VERSION;
  attr["model"] = HAVE_EI ? "edge_impulse" : "rules";
  attr["mpu_ok"] = mpuOk;
  attr["rssi"] = WiFi.RSSI();
  char abuf[200];
  serializeJson(attr, abuf, sizeof(abuf));
  mqtt.publish("v1/devices/me/attributes", abuf);
  Serial.println("ThingsBoard connected");
  return true;
}

// ---------- งบส่งข้อมูล (กันเกินโควตาฟรีของ ThingsBoard) ----------
// ได้ DP_BUDGET_PER_HOUR ค่าต่อชั่วโมง สะสมได้ไม่เกิน 1 นาที
// ท่านั่ง/การเตือนที่เปลี่ยนส่งได้ก่อนแม้งบหมด (ติดลบได้ไม่เกิน 1 นาที) ค่าอื่นรอจนมีงบ
static const float DP_PER_MS = DP_BUDGET_PER_HOUR / 3600000.0f;
static const float DP_BUCKET = DP_BUDGET_PER_HOUR / 60.0f;
float dpTokens = DP_BUCKET;
unsigned long dpRefillMs = 0;

void refillBudget() {
  unsigned long now = millis();
  dpTokens += (now - dpRefillMs) * DP_PER_MS;
  if (dpTokens > DP_BUCKET) dpTokens = DP_BUCKET;
  dpRefillMs = now;
}

static const char *FSR_KEYS[6] = {"fsr1", "fsr2", "fsr3", "fsr4", "fsr5", "fsr6"};
Point lastSent;                    // ค่าที่ส่งไปล่าสุดของแต่ละ key
bool haveLastSent = false;
unsigned long lastSnapshotAtMs = 0;

enum SendResult { SEND_SKIPPED, SEND_SENT, SEND_FAILED };

// ส่ง 1 จุด เฉพาะค่าที่เปลี่ยนจากที่ส่งไปล่าสุด (ส่งครบทุกค่าทุก FULL_SNAPSHOT_SEC)
SendResult sendPoint(const Point &p) {
  bool snapshot = !haveLastSent || p.atMs - lastSnapshotAtMs >= FULL_SNAPSHOT_SEC * 1000UL;
  bool important = strcmp(p.posture, lastSent.posture) != 0 || p.occupied != lastSent.occupied ||
                   p.bad != lastSent.bad || p.alert != lastSent.alert;
  int n = 0;  // จำนวนค่าที่จะส่ง
  bool sendFsr[6];
  for (int i = 0; i < 6; i++) {
    sendFsr[i] = snapshot || abs((int)p.fsrPct[i] - (int)lastSent.fsrPct[i]) >= FSR_DEADBAND_PCT;
    n += sendFsr[i];
  }
  bool sendBackrest = snapshot || fabsf(p.backrestDeg - lastSent.backrestDeg) >= 2.0f;
  n += sendBackrest;
  if (important || snapshot) n += 6;  // posture, occupied, bad_posture, bad_posture_sec, sit_minutes, alert
  if (snapshot) n += 4;               // confidence, anomaly, battery_v, battery_pct
  if (n == 0) return SEND_SKIPPED;    // ไม่มีอะไรเปลี่ยน

  // คิดข้อความละอย่างน้อย 2 ค่า เพราะโควตาข้อความ (0.5M) เป็นครึ่งหนึ่งของโควตาค่า (1M)
  refillBudget();
  float cost = n < 2 ? 2 : n;
  bool allowed = (important && dpTokens > -DP_BUCKET) || dpTokens >= cost;
  if (!allowed) return SEND_SKIPPED;  // งบหมด จุดถัดไปจะเทียบกับค่าที่ส่งล่าสุดแล้วส่งให้เอง

  JsonDocument doc;
  int64_t ts = pointEpochMs(p);
  JsonObject v = ts ? doc["values"].to<JsonObject>() : doc.to<JsonObject>();
  if (ts) doc["ts"] = ts;
  if (important || snapshot) {
    v["posture"] = p.posture;
    v["occupied"] = p.occupied;
    v["bad_posture"] = p.bad;
    v["bad_posture_sec"] = p.badSec;
    v["sit_minutes"] = p.sitMin;
    v["alert"] = ALERT_NAMES[p.alert];
  }
  for (int i = 0; i < 6; i++)
    if (sendFsr[i]) v[FSR_KEYS[i]] = p.fsrPct[i];
  if (sendBackrest) v["backrest_deg"] = roundf(p.backrestDeg * 10) / 10.0f;
  if (snapshot) {
    v["confidence"] = roundf(p.confidence * 1000) / 1000.0f;
    v["anomaly"] = roundf(p.anomaly * 1000) / 1000.0f;
    v["battery_v"] = roundf(p.vbat * 100) / 100.0f;
    v["battery_pct"] = batteryPercent(p.vbat);
  }
  char buf[512];
  size_t len = serializeJson(doc, buf, sizeof(buf));
  if (!mqtt.publish("v1/devices/me/telemetry", (const uint8_t *)buf, len, false)) return SEND_FAILED;

  dpTokens -= cost;
  lastPublishMs = millis();
  if (important || snapshot) {
    strlcpy(lastSent.posture, p.posture, sizeof(lastSent.posture));
    lastSent.occupied = p.occupied;
    lastSent.bad = p.bad;
    lastSent.alert = p.alert;
    lastSent.sitMin = p.sitMin;
  }
  for (int i = 0; i < 6; i++)
    if (sendFsr[i]) lastSent.fsrPct[i] = p.fsrPct[i];
  if (sendBackrest) lastSent.backrestDeg = p.backrestDeg;
  if (snapshot) {
    lastSnapshotAtMs = p.atMs;
    haveLastSent = true;
  }
  return SEND_SENT;
}

// ไล่ส่งจุดที่ค้าง ส่งจริงไม่เกิน maxPublish ข้อความ คืนค่าจำนวนข้อความที่ส่ง
int flushPoints(int maxPublish) {
  int handled = 0, published = 0;
  while (handled < nPoints && published < maxPublish) {
    SendResult r = sendPoint(points[handled]);
    if (r == SEND_FAILED) break;
    handled++;
    if (r == SEND_SENT) published++;
  }
  if (handled) {
    memmove(points, points + handled, (nPoints - handled) * sizeof(Point));
    nPoints -= handled;
    lastUploadMs = millis();
  }
  return published;
}

// ส่งไม่สำเร็จติดกัน: รอนานขึ้นเรื่อย ๆ 5, 10, 20, 40, 60 นาที ไม่ให้เปลืองแบตตอน Wi-Fi ใช้ไม่ได้นาน ๆ
unsigned long uploadRetryGapMs() {
  if (uploadFails == 0) return 0;
  unsigned long m = 5UL << (uploadFails > 5 ? 4 : uploadFails - 1);
  return (m > 60 ? 60 : m) * 60000UL;
}

// แบบรอ: เปิด Wi-Fi ส่งทุกจุดที่ค้าง แล้วปิด Wi-Fi (ใช้ตอนเปิดเครื่อง, ตอนเก้าอี้ว่าง, และโหมดส่งเป็นช่วง)
bool uploadNow() {
  lastUploadTryMs = millis();
  buzzer(false);  // ส่งข้อมูลใช้เวลาหลายวินาที ห้ามให้ buzzer ค้าง
  setLed(LED_STATUS, HIGH);
  bool ok = false;

  Serial.print("Upload: Wi-Fi ");
  if (!wifiUp()) {
    Serial.println("FAILED");
  } else {
    Serial.println("OK");
    startTimeSync();
    static bool waitedForTime = false;  // รอ NTP แค่ครั้งแรก ถ้าใช้ไม่ได้ ThingsBoard จะใช้เวลาที่ได้รับแทน
    if (!waitedForTime) {
      waitedForTime = true;
      unsigned long t0 = millis();
      while (!timeSynced() && millis() - t0 < 5000) delay(100);
    }
    if (mqttConnect()) {
      int sent = 0;
      while (nPoints > 0) {
        int before = nPoints;
        int pub = flushPoints(1);
        sent += pub;
        if (nPoints == before) break;  // ส่งไม่ออก
        if (pub) {                     // ไม่เกิน 10 ข้อความ/วินาที (ลิมิตต่ออุปกรณ์ 50/วินาที)
          mqtt.loop();
          delay(100);
        }
      }
      ok = nPoints == 0;
      // รอรับค่าตั้งจาก dashboard สักครู่
      unsigned long t0 = millis();
      while (!settingsReceived && millis() - t0 < 1500) {
        mqtt.loop();
        delay(10);
      }
      Serial.printf("Upload: sent %d messages%s\n", sent, ok ? "" : " (some left, retry later)");
    }
  }

  wifiDown();
  setLed(LED_STATUS, LOW);
  eiReset();  // ข้อมูลช่วงที่ส่งขาดหาย เริ่มเก็บ window ใหม่
  if (ok) uploadFails = 0;
  else if (uploadFails < 10) uploadFails++;
  return ok;
}

// แบบไม่รอ ใช้ตอนมีคนนั่ง (REALTIME_WHILE_SEATED 1): เซนเซอร์และการเตือนทำงานต่อได้ระหว่างต่อ Wi-Fi
void onlineTick() {
  unsigned long now = millis();
  static unsigned long notConnectedSince = 0;
  if (WiFi.status() != WL_CONNECTED) {
    if (WiFi.getMode() == WIFI_OFF) {
      if ((long)(now - wifiRetryAtMs) >= 0) wifiStart();
      return;
    }
    if (notConnectedSince == 0) notConnectedSince = now;
    if (now - notConnectedSince > 15000) {
      // ต่อไม่ติดใน 15 วินาที: ปิดวิทยุไว้ก่อน แล้วค่อยลองใหม่ (30 วินาที, 1 นาที, แล้วทุก 2 นาที)
      radioOff();
      notConnectedSince = 0;
      if (wifiFails < 3) wifiFails++;
      unsigned long gap = 30000UL << (wifiFails - 1);
      wifiRetryAtMs = now + gap;
      Serial.printf("Wi-Fi not connected, retry in %lu s\n", gap / 1000);
    }
    return;
  }
  notConnectedSince = 0;
  wifiFails = 0;
  startTimeSync();
  if (!mqtt.connected()) {
    if (now - lastMqttTryMs < mqttRetryGapMs) return;
    if (!mqttConnect()) return;
  }
  mqtt.loop();
  // ส่งไม่เกิน 5 ข้อความ/วินาที ตอนมีข้อมูลค้างจากช่วงเน็ตหลุด
  if (nPoints > 0 && now - lastPublishMs >= 200) flushPoints(1);
}

// แบตใกล้หมด: ปิดทุกอย่างแล้ว deep sleep ตื่นมาเช็กใหม่ทุก 1 ชั่วโมง (ชาร์จแล้วจะทำงานต่อเอง)
void checkLowBattery(float margin) {
  if (!LOW_POWER) return;  // ตอนเสียบ USB ทดสอบ ไม่ต้องตัด
  float v = readBatteryV();
  if (v < 2.5f || v >= VBAT_CUTOFF_V + margin) return;  // ต่ำกว่า 2.5 V = ไม่ได้ต่อแบต/วัดไม่ได้
  Serial.printf("Battery low %.2f V -> deep sleep 60 min (please charge)\n", v);
  buzzer(false);
  setLed(LED_ALERT, LOW);
  setLed(LED_STATUS, LOW);
  mpuSleep();
  radioOff();
  Serial.flush();
  esp_sleep_enable_timer_wakeup(60ULL * 60 * 1000000);
  esp_deep_sleep_start();
}

// ======================================================
//  สลับโหมด
// ======================================================
void enterSeated() {
  mode = SEATED;
  unsigned long now = millis();
  if (sitStartMs == 0) sitStartMs = now;
  lastSeatSeenMs = now;
  nextSample = now;
  lastPointMs = now;
  wifiRetryAtMs = now;
  lastRecordMs = 0;
  lastRecPosture = "";
  goodSinceMs = 0;
  posture = "unknown";  // ยังไม่รู้ท่า จนกว่าโมเดลจะได้ข้อมูลครบ 1 window
  mpuWake();
  eiReset();
  if (REALTIME_WHILE_SEATED && WiFi.status() != WL_CONNECTED) {
    wifiFails = 0;
    wifiStart();
  }
  Serial.println("Someone sat down -> SEATED");
}

void enterIdle() {
  mode = IDLE;
  posture = "empty";
  confidence = 0;
  anomaly = 0;
  occupied = false;
  sitStartMs = 0;
  badStartMs = 0;
  goodSinceMs = 0;
  alertType = ALERT_NONE;
  alertPending = false;
  buzzer(false);
  setLed(LED_ALERT, LOW);
  setLed(LED_STATUS, LOW);
  recordPoint();
  uploadNow();  // ส่งจุดสุดท้าย ("empty") แล้วปิด Wi-Fi
  mpuSleep();
  Serial.println("Seat empty -> IDLE");
}

void idleWait(uint32_t ms) {
  if (LOW_POWER) {
    Serial.flush();
    esp_sleep_enable_timer_wakeup((uint64_t)ms * 1000ULL);
    esp_light_sleep_start();
  } else {
    delay(ms);
    if (mqtt.connected()) mqtt.loop();
  }
}

// ======================================================
//  setup / loop
// ======================================================
void setup() {
  Serial.begin(115200);
#if !COLLECT_MODE && ARDUINO_USB_CDC_ON_BOOT && ARDUINO_USB_MODE
  Serial.setTxTimeoutMs(0);  // ใช้แบตไม่ได้เสียบคอม: ไม่ต้องรอส่ง Serial (ไม่งั้นทุกบรรทัดที่พิมพ์ทำให้เครื่องช้า)
#endif
  delay(1500);
#if BUZZER_FREQ > 0
  ledcSetup(BUZZER_CH, BUZZER_FREQ, 8);  // passive buzzer: ส่งคลื่นสี่เหลี่ยมตามความถี่
  ledcAttachPin(BUZZER_PIN, BUZZER_CH);
#else
  pinMode(BUZZER_PIN, OUTPUT);
#endif
  if (LED_ALERT >= 0) pinMode(LED_ALERT, OUTPUT);
  if (LED_STATUS >= 0) pinMode(LED_STATUS, OUTPUT);
  buzzer(false);
  analogReadResolution(12);
  for (int i = 0; i < 6; i++) analogSetPinAttenuation(FSR_PINS[i], ADC_11db);
  analogSetPinAttenuation(VBAT_PIN, ADC_11db);

  Wire.begin(I2C_SDA, I2C_SCL);
  mpuOk = (mpu.begin() == 0);
  if (mpuOk) {
    mpuWake();
    // ทิศแรงโน้มถ่วงตอนเปิดเครื่อง = พนักพิงตั้งปกติ (ห้ามขยับเก้าอี้ประมาณ 1 วินาที)
    float sum[3] = {0, 0, 0};
    for (int i = 0; i < 20; i++) {
      delay(10);
      mpu.update();
      sum[0] += mpu.getAccX();
      sum[1] += mpu.getAccY();
      sum[2] += mpu.getAccZ();
    }
    for (int i = 0; i < 3; i++) baseAcc[i] = sum[i] / 20;
  }

#if COLLECT_MODE
  return;  // โหมดเก็บข้อมูล: ห้ามพิมพ์อย่างอื่นนอกจากตัวเลข เพื่อให้ edge-impulse-data-forwarder อ่านได้
#endif

  Serial.printf("\nHealth Chair %s | model: %s | MPU6050: %s | low power: %s | realtime: %s\n", FW_VERSION,
                HAVE_EI ? "Edge Impulse" : "rules (no EI library yet)", mpuOk ? "OK" : "NOT FOUND",
                LOW_POWER ? "on" : "off", REALTIME_WHILE_SEATED ? "on" : "off");
#if HAVE_EI
  Serial.printf("EI window %d ms, %d Hz, labels %d\n",
                (int)(EI_CLASSIFIER_RAW_SAMPLE_COUNT * EI_CLASSIFIER_INTERVAL_MS),
                (int)EI_CLASSIFIER_FREQUENCY, EI_CLASSIFIER_LABEL_COUNT);
  if ((int)(EI_CLASSIFIER_FREQUENCY + 0.5f) != SAMPLE_HZ)
    Serial.printf("WARNING: model uses %d Hz but SAMPLE_HZ is %d, results will be wrong\n",
                  (int)(EI_CLASSIFIER_FREQUENCY + 0.5f), SAMPLE_HZ);
#endif
  Serial.printf("Battery %.2f V\n", readBatteryV());
  // ตื่นจาก deep sleep เพราะแบตต่ำ: ต้องสูงกว่าเกณฑ์ 0.1 V จึงทำงานต่อ (กันเปิด-ปิดวนตอนแบตใกล้หมด)
  checkLowBattery(esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_TIMER ? 0.10f : 0.0f);

  if (LOW_POWER) setCpuFrequencyMhz(80);  // พอสำหรับโมเดลและ Wi-Fi กินไฟน้อยกว่า 240 MHz มาก
  mqtt.setServer(TB_SERVER, TB_PORT);
  mqtt.setBufferSize(1024);
  mqtt.setSocketTimeout(3);
  mqtt.setCallback(onMqttMessage);

  // ส่งครั้งแรก: ซิงก์เวลา + รับค่าตั้งจาก dashboard + บอกว่าเครื่องออนไลน์
  readFsr();
  recordPoint();
  uploadNow();
  mpuSleep();
}

void loop() {
  unsigned long now = millis();

#if COLLECT_MODE
  static unsigned long nextCollect = 0;
  if ((long)(now - nextCollect) >= 0) {
    nextCollect = now + 1000 / SAMPLE_HZ;
    readSensors();
    Serial.printf("%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f\r\n",
                  fsr[0], fsr[1], fsr[2], fsr[3], fsr[4], fsr[5], accX, accY, accZ);
  }
  return;
#endif

  if (mode == IDLE) {
    // ---------- ไม่มีคนนั่ง: เช็ก FSR ทุก 1 วินาที ----------
    static int seatHits = 0;
    readFsr();
    if (seatTotal() > SEAT_ON_THRESHOLD) {
      if (++seatHits >= 2) {  // มีแรงกด 2 ครั้งติด (~2 วินาที) ถือว่ามีคนนั่ง
        seatHits = 0;
        enterSeated();
        return;
      }
    } else {
      seatHits = 0;
    }
    static unsigned long lastBatteryCheckMs = 0;
    if (now - lastBatteryCheckMs >= 60000UL) {
      lastBatteryCheckMs = now;
      checkLowBattery(0);
    }
    // ส่งสถานะแบตทุก HEARTBEAT_MIN นาที และส่งข้อมูลที่ค้าง (ถ้าส่งไม่สำเร็จจะเว้นนานขึ้นเรื่อย ๆ)
    bool heartbeatDue = now - lastUploadMs >= HEARTBEAT_MIN * 60000UL;
    if ((heartbeatDue || nPoints > 0) && now - lastUploadTryMs >= uploadRetryGapMs()) {
      if (heartbeatDue) recordPoint();
      uploadNow();
    }
    idleWait(1000);
    return;
  }

  // ---------- มีคนนั่ง: อ่าน 20 Hz ----------
  if ((long)(now - nextSample) >= 0) {
    nextSample += 1000 / SAMPLE_HZ;
    if ((long)(now - nextSample) >= 0) nextSample = now + 1000 / SAMPLE_HZ;  // ช้าไปมาก (เช่นตอนส่งข้อมูล) ไม่ต้องไล่ตาม
    readSensors();
    if (seatTotal() > SEAT_ON_THRESHOLD) lastSeatSeenMs = now;
    classify();
    bool alertStarted = updateTimersAndAlerts();

    if (REALTIME_WHILE_SEATED) {
      // เก็บจุดทุก TELEMETRY_INTERVAL_SEC และทันทีเมื่อท่านั่งหรือการเตือนเปลี่ยน (ห่างกันอย่างน้อย 1 วินาที)
      // ตอนส่ง sendPoint() จะเลือกส่งเฉพาะค่าที่เปลี่ยน
      static Alert lastRecAlert = ALERT_NONE;
      bool changed = posture != lastRecPosture || alertType != lastRecAlert;
      if (now - lastRecordMs >= TELEMETRY_INTERVAL_SEC * 1000UL || (changed && now - lastRecordMs >= 1000)) {
        lastRecordMs = now;
        lastRecPosture = posture;
        lastRecAlert = alertType;
        recordPoint();
      }
    } else {
      if (now - lastPointMs >= POINT_INTERVAL_SEC * 1000UL) {
        lastPointMs = now;
        recordPoint();
      }
      if (alertStarted) {  // เพิ่งเริ่มเตือน เก็บจุดไว้แล้วรีบส่งให้ dashboard เห็น
        recordPoint();
        alertPending = true;
      }
      unsigned long gap = uploadIntervalSec * 1000UL;
      if (uploadRetryGapMs() > gap) gap = uploadRetryGapMs();
      bool alertDue = alertPending && uploadFails == 0 && now - lastUploadTryMs > 20000;
      if (alertDue || now - lastUploadTryMs >= gap) {
        alertPending = false;
        uploadNow();
      }
    }
    if (now - lastSeatSeenMs > STAND_RESET_SEC * 1000UL) {
      enterIdle();
      return;
    }
    // LED เขียวกะพริบสั้น ๆ ทุก 3 วินาที = กำลังทำงาน (ไม่เปิดค้างเพื่อประหยัดไฟ)
    setLed(LED_STATUS, (now % 3000) < 1000 / SAMPLE_HZ ? HIGH : LOW);
  }
  if (REALTIME_WHILE_SEATED) onlineTick();
  else if (!LOW_POWER && mqtt.connected()) mqtt.loop();

  // รอถึงรอบอ่านถัดไป ให้ CPU ได้พักแทนการวนรอเปล่า ๆ (ประหยัดไฟ)
  long wait = (long)(nextSample - millis());
  if (wait > 0) delay(wait);
}
