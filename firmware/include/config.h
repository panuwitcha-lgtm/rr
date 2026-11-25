// Health Chair - ค่าที่ต้องแก้ก่อนอัปโหลด
#pragma once

// ===== 1) โหมดการทำงาน =====
// 1 = โหมดเก็บข้อมูลให้ Edge Impulse (พิมพ์ค่าเซนเซอร์เป็น CSV ทาง Serial ไม่ต่อ Wi-Fi)
// 0 = โหมดใช้งานจริง (จำแนกท่านั่ง + แจ้งเตือน + ส่งข้อมูลขึ้น ThingsBoard)
#define COLLECT_MODE 0

// 1 = ประหยัดแบต: ไม่มีคนนั่งจะปิด Wi-Fi และหลับ (light sleep) ตื่นมาเช็ก FSR ทุก 1 วินาที, CPU 80 MHz
// 0 = ตื่นและต่อ Wi-Fi ตลอด (ใช้ตอนเสียบ USB ดู Serial Monitor เพราะตอนหลับ Serial ทาง USB จะหลุด, แบตอยู่ได้ราว 1 สัปดาห์)
#define LOW_POWER 1

// ===== 2-3) Wi-Fi และ ThingsBoard token =====
// รหัส Wi-Fi และ token เป็นความลับ ห้ามขึ้น GitHub
// ให้ copy include/secrets.example.h เป็น include/secrets.h แล้วแก้ในไฟล์นั้น
// (.gitignore กันไฟล์ secrets.h ไม่ให้ถูกอัปขึ้น GitHub)
#if __has_include("secrets.h")
#include "secrets.h"
#else
#define WIFI_SSID     "your-wifi-name"              // ต้องเป็น Wi-Fi 2.4 GHz
#define WIFI_PASSWORD "your-wifi-password"
#define TB_TOKEN      "PUT_YOUR_ACCESS_TOKEN_HERE"  // จากหน้า Device ใน ThingsBoard (Copy access token)
#endif

// ถ้า DNS มีปัญหา ใช้ IP แทนได้: thingsboard.cloud[44.194.165.190] | eu.thingsboard.cloud[3.69.110.78]
#define TB_SERVER "thingsboard.cloud"
#define TB_PORT   1883

// ===== 4) การส่งข้อมูล (มีผลกับอายุแบตมากที่สุด) =====
// 1 = realtime: ตอนมีคนนั่งต่อ Wi-Fi ค้างไว้ เช็กทุก TELEMETRY_INTERVAL_SEC แล้วส่งค่าที่เปลี่ยน
//     (ท่านั่ง/การเตือนขึ้น dashboard ภายในราว 1-2 วินาที แบตราว 25-30 วัน ที่นั่งวันละ 8 ชม.)
// 0 = ส่งเป็นช่วง: เก็บค่าทุก POINT_INTERVAL_SEC แล้วเปิด Wi-Fi ส่งรวดเดียวทุก UPLOAD_INTERVAL_SEC
//     (dashboard ช้าได้ถึง 1 นาที แบตราว 30 วันขึ้นไป)
#define REALTIME_WHILE_SEATED 1
#define TELEMETRY_INTERVAL_SEC 1   // โหมด realtime: เช็กและส่งทุกกี่วินาที
#define POINT_INTERVAL_SEC  10     // โหมดส่งเป็นช่วง: เก็บค่า 1 จุดทุกกี่วินาที
#define UPLOAD_INTERVAL_SEC 60     // โหมดส่งเป็นช่วง: เปิด Wi-Fi ส่งทุกกี่วินาที (แก้จาก dashboard ได้)
#define HEARTBEAT_MIN       30     // ตอนไม่มีคนนั่ง ส่งสถานะแบตทุกกี่นาที

// ===== 5) โควตาของ ThingsBoard Cloud แผนฟรี =====
// แผนฟรีได้ 1 ล้านค่า (data points) และ 5 แสนข้อความต่อเดือน และต่ออุปกรณ์ไม่เกิน 15,000 ค่าต่อชั่วโมง
// ถ้าส่งครบ 17 ค่าทุกวินาที จะโดนตีกลับหลังนั่งได้ราว 15 นาทีของทุกชั่วโมง และโควตาเดือนหมดในราว 16 ชม.
// เครื่องจึงเช็กทุกวินาที แต่ส่งเฉพาะค่าที่เปลี่ยน และส่งครบทุกค่าทุก FULL_SNAPSHOT_SEC
#define FULL_SNAPSHOT_SEC   60    // ส่งครบทุกค่า (รวมแบตและความมั่นใจของโมเดล) ทุกกี่วินาที
#define FSR_DEADBAND_PCT    5     // FSR เปลี่ยนไม่ถึงกี่ % ไม่ต้องส่ง (กันค่าแกว่งเล็ก ๆ กินโควตา)
#define DP_BUDGET_PER_HOUR  3600  // ส่งได้ไม่เกินกี่ค่าต่อชั่วโมง: 3600 พอให้นั่งวันละ 8 ชม. ทั้งเดือน (ห้ามเกิน 12000)

// ===== 6) การแจ้งเตือน (แก้จาก dashboard ได้ด้วย) =====
#define BAD_POSTURE_ALERT_SEC 10   // นั่งผิดท่าต่อเนื่องกี่วินาทีจึงเตือน
#define SIT_LIMIT_MIN         45   // นั่งต่อเนื่องกี่นาทีจึงเตือนให้ลุก
#define STAND_RESET_SEC       60   // ลุกจากเก้าอี้นานกี่วินาทีจึงถือว่าลุกแล้ว (เริ่มนับเวลานั่งใหม่และเข้าโหมดหลับ)
#define SEAT_ON_THRESHOLD     0.15f // ผลรวม FSR1-4 (0-4) เกินค่านี้ถือว่ามีคนนั่ง

// ===== 7) เลือกบอร์ด (แก้บรรทัดเดียว) =====
// 1 = บอร์ด kk (ESP32-S3-WROOM-1-N16R8 บนบอร์ด, ขายาวทั้งบอร์ด, สวิตช์เปิด/ปิด J2, Micro USB J10)
//     ตรงกับ schematic ใน easyeda/health-chair-kk และเอกสาร SRS / Data Element Design
// 2 = บอร์ด EasyEDA ของเอ็ม (TP4056 SMD + AP2112K, buzzer ผ่าน S8050, ไม่มี LED ให้ ESP32 คุม)
//     ตรงกับแบบล่าสุดของเอ็ม (8 พ.ย. 2026) ที่ย้าย FSR2 มา IO9 แล้ว
#define BOARD 2

// FSR1-4 = เบาะ: หน้าซ้าย, หน้าขวา, หลังซ้าย, หลังขวา
// FSR5 = พนักพิงส่วนเอว (ล่าง), FSR6 = พนักพิงส่วนบน
// ทุกขา FSR / แบต ต้องเป็น ADC1 (IO1-IO10) เพราะ ADC2 ใช้ไม่ได้ตอนเปิด Wi-Fi
#if BOARD == 1
static const int FSR_PINS[6] = {1, 2, 9, 10, 6, 7};  // J3-J8
#define VBAT_PIN    8    // แรงดันแบต หาร 2 (R1/R2 100k)
#define BUZZER_PIN  12   // ผ่าน Q1 S8050
#define BUZZER_FREQ 0    // 0 = active buzzer (HMB1275-05B มีวงจรกำเนิดเสียงในตัว)
#define LED_ALERT   13   // D1 LED แดง
#define LED_STATUS  14   // D2 LED เขียว
#define I2C_SDA     39   // J9 GY-521
#define I2C_SCL     41
#define MPU_INT     40   // ต่อไว้บนบอร์ด แต่โค้ดยังไม่ได้ใช้
#elif BOARD == 2
static const int FSR_PINS[6] = {3, 9, 4, 5, 6, 7};
#define VBAT_PIN    10   // R7/R8 100k หาร 2
#define BUZZER_PIN  40   // ผ่าน R19 1k → Q2 S8050
#define BUZZER_FREQ 2300 // buzzer 2300 Hz แบบ passive ต้องส่งความถี่ให้ (ถ้าเปลี่ยนเป็น active buzzer ตั้ง 0)
#define LED_ALERT   -1   // ไม่มี LED (-1 = ไม่ใช้)
#define LED_STATUS  -1
#define I2C_SDA     38
#define I2C_SCL     39
#define MPU_INT     -1   // ไม่ได้ต่อ
#else
#error "BOARD ต้องเป็น 1 หรือ 2"
#endif
#define MPU_ADDR    0x68

// ===== 8) แบตเตอรี่ =====
// ถ่าน 18650 x4 ต่อขนาน (3.0-4.2 V) วัดผ่านตัวหาร 2 บนบอร์ด
// ห้ามต่อถ่านแบบอนุกรม และห้ามให้แรงดันที่ขา IO8 เกิน 3.1 V
#define VBAT_DIVIDER  2.0f
#define VBAT_FULL_V   4.20f
#define VBAT_EMPTY_V  3.30f
#define VBAT_CUTOFF_V 3.30f   // ต่ำกว่านี้เครื่องจะหลับลึก (deep sleep) ตื่นมาเช็กทุก 1 ชม. จนกว่าจะชาร์จ กันถ่านเสีย

// ===== 9) Edge Impulse =====
// ความถี่เก็บข้อมูล ต้องตรงกับตอนเก็บข้อมูลใน Edge Impulse
#define SAMPLE_HZ 20
// ถ้าความมั่นใจของโมเดลต่ำกว่านี้ หรือ anomaly สูงกว่านี้ จะถือว่า "unknown"
#define MIN_CONFIDENCE    0.60f
#define ANOMALY_THRESHOLD 0.30f
