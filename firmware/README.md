# Health Chair: คู่มือตั้งค่า ThingsBoard + Edge Impulse ทีละขั้น

โค้ดชุดนี้ (เวอร์ชัน 1.4.0) ใช้กับบอร์ด kk (ESP32-S3-WROOM-1-N16R8 บนบอร์ด, Micro USB J10 ช่องเดียวใช้ทั้งชาร์จและอัปโหลด, ชาร์จด้วยโมดูล TP4056, สวิตช์เปิด/ปิด J2) และบอร์ด EasyEDA ของเอ็ม เลือกด้วย `#define BOARD` ใน `include/config.h` (ตอนนี้ตั้งเป็น `2` = บอร์ดของเอ็ม) + FSR 6 ตัว + MPU6050 (GY-521) และใช้เครื่องมือแบบเดียวกับในสไลด์วิชา CPE 23367: VS Code + PlatformIO, ส่งข้อมูลขึ้น thingsboard.cloud ผ่าน MQTT ด้วย access token และใช้โมเดลจาก Edge Impulse ที่ export เป็น Arduino library

## ภาพรวมการทำงาน

1. ESP32 อ่าน FSR 6 ตัว (เบาะ 4 + พนักพิง 2) และความเร่งจาก MPU6050 วินาทีละ 20 ครั้ง
2. โมเดล Edge Impulse ดูข้อมูลย้อนหลัง 2 วินาที แล้วบอกว่าเป็นท่าไหน ทำนายใหม่ทุก 0.5 วินาที
3. นั่งผิดท่าต่อเนื่องเกิน 10 วินาที: LED แดงติด + buzzer บี๊บสั้น ๆ / นั่งต่อเนื่องเกิน 45 นาที: บี๊บยาวทุก 5 วินาที
4. ระหว่างนั่ง ต่อ Wi-Fi ค้างไว้แบบประหยัดไฟ (modem sleep) เช็กทุก 1 วินาที แล้วส่งค่าที่เปลี่ยนขึ้น ThingsBoard ทันที ท่านั่งและการเตือนจึงขึ้น dashboard ภายในราว 1–2 วินาที และส่งครบทุกค่าทุก 1 นาที (ดูหัวข้อ "โควตา ThingsBoard" ว่าทำไมไม่ส่งครบทุกค่าทุกวินาที)
5. ไม่มีคนนั่ง: ปิด Wi-Fi ให้ MPU6050 หลับ และ ESP32 หลับ (light sleep) ตื่นมาเช็ก FSR ทุก 1 วินาที มีแรงกดบนเบาะ 2 วินาทีติดจึงตื่นเต็มตัว ส่วนตอนว่างจะส่งสถานะแบตทุก 30 นาที
6. ปิดเสียง/ปรับเวลาเตือนจาก dashboard ได้ ตอนมีคนนั่งเครื่องได้ค่าใหม่ทันที ตอนเก้าอี้ว่างได้ตอนมีคนมานั่งหรือตอนส่งสถานะแบตรอบถัดไป
7. แบตเหลือต่ำกว่า 3.30 V เครื่องจะหลับลึกเพื่อถนอมถ่าน ชาร์จแล้วกลับมาทำงานเอง

ท่านั่งที่ให้โมเดลแยก (ใช้ชื่อนี้เป็น label ตอนเก็บข้อมูล พิมพ์ให้ตรงทุกตัวอักษร)

| label | ความหมาย | นับเป็นท่าผิด |
|---|---|---|
| `empty` | ไม่มีคนนั่ง | ไม่ |
| `upright` | นั่งตรง หลังพิงพนัก | ไม่ |
| `lean_forward` | ก้ม/โน้มตัวไปข้างหน้า หลังไม่แตะพนัก | ใช่ |
| `lean_back` | เอนหลังมาก หรือไถลตัวลง (หลังบนแตะ เอวไม่แตะ) | ใช่ |
| `lean_left` | เอียงตัวไปซ้าย | ใช่ |
| `lean_right` | เอียงตัวไปขวา | ใช่ |
| `perch` | นั่งริมเก้าอี้ ไม่พิงพนัก | ใช่ |

ถ้ายังไม่ได้ใส่โมเดล โค้ดจะ build ได้และใช้กฎง่าย ๆ จากค่า FSR แยกท่าไปก่อน (ค่าเกณฑ์ยังไม่ได้ปรับกับเก้าอี้จริง) เพื่อให้ทดสอบ ThingsBoard ได้ก่อนเลย

## ไฟล์ในโฟลเดอร์นี้

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `platformio.ini` | ตั้งค่าบอร์ด ESP32-S3 N16R8 และ library ที่ต้องใช้ (PlatformIO โหลดให้เอง) |
| `include/secrets.example.h` | copy เป็น `include/secrets.h` แล้วใส่ Wi-Fi และ token ThingsBoard (ไฟล์ secrets.h ไม่ขึ้น GitHub) |
| `include/config.h` | เลือกบอร์ด (`BOARD`), โหมดเก็บข้อมูล, เวลาเตือน, ค่าแบต |
| `src/main.cpp` | โค้ดหลัก |
| `lib/` | ที่วาง library ที่ดาวน์โหลดจาก Edge Impulse |

## แบตเตอรี่: ถ่าน 18650 × 4 ต่อขนาน

ต่อเข้าขั้วแบตของโมดูล TP4056 บนบอร์ด (ห้ามต่อแบบอนุกรม) ชาร์จด้วยสาย Micro USB ที่ช่อง J10 บนบอร์ด ตัวเลขข้างล่างเป็นการประมาณจากค่ากินไฟของชิ้นส่วน ยังไม่ได้วัดจริง

| สถานะ | กินไฟเฉลี่ย | ต่อวัน (นั่ง 8 ชม.) |
|---|---|---|
| มีคนนั่ง: ESP32 80 MHz + ต่อ Wi-Fi ค้าง (modem sleep) + MPU6050 (เฉพาะ accelerometer) + FSR + ส่งทุกครั้งที่ค่าเปลี่ยน | ~35–40 mA | ~280–320 mAh |
| ไม่มีคนนั่ง 16 ชม.: light sleep + ส่งสถานะแบตทุก 30 นาที | ~1–2.5 mA | ~20–40 mAh |
| **รวม** | | **~300–360 mAh/วัน** |

ถ่านแท้ 3000 mAh × 4 ใช้ได้จริงราว 10,000 mAh จึงอยู่ได้ประมาณ **25–30 วัน** (เผื่อถ่านจริงจุไม่ถึงสเปกและสัญญาณ Wi-Fi ต่างกันแต่ละที่) ถ้าเปลี่ยนเป็นส่งเป็นช่วง (`REALTIME_WHILE_SEATED 0`, dashboard ช้าได้ถึง 1 นาที) จะได้ราว 30 วันขึ้นไป ถ้าปิดโหมดประหยัด (`LOW_POWER 0`) ต่อ Wi-Fi ตลอด จะเหลือราว 1 สัปดาห์

ประหยัดเพิ่มได้อีกราว 10 %: บนโมดูล GY-521 มี LED ไฟเลี้ยงที่ติดตลอดเวลา (กินไฟราว 1–2 mA แม้ตอนเครื่องหลับ) ใช้หัวแร้งถอด LED ตัวนั้นออก หรือตัดตัวต้านทานที่ต่ออยู่กับมัน โมดูลยังทำงานเหมือนเดิม

ค่าจริงควรวัดด้วยมิเตอร์ USB หรือมัลติมิเตอร์ แล้วใส่ในรายงาน (วัดตอนนั่งกับตอนเก้าอี้ว่างแยกกัน)

ขาที่ใช้ (`BOARD 1` = บอร์ด kk): FSR1–6 = IO1, IO2, IO9, IO10, IO6, IO7 ที่ช่อง J3–J8 (หน้าซ้าย, หน้าขวา, หลังซ้าย, หลังขวา, พนักพิงส่วนเอว, พนักพิงส่วนบน), MPU6050 (J9) SDA IO39 / SCL IO41, แบต IO8, buzzer IO12, LED แดง IO13, LED เขียว IO14

ขาที่ใช้ (`BOARD 2` = บอร์ดของเอ็ม แบบ 8 พ.ย. 2026): FSR1–6 = IO3, IO9, IO4, IO5, IO6, IO7, แบต IO10 (R7/R8 100k), buzzer IO40 ผ่าน S8050 (buzzer 2300 Hz โค้ดส่ง PWM ให้ ตั้งที่ `BUZZER_FREQ`), MPU6050 SDA IO38 / SCL IO39, ไม่มี LED ให้ ESP32 คุม (LED1/LED2 เป็นไฟสถานะชาร์จของ TP4056)

 **ตอนติด FSR บนเก้าอี้ ให้เสียบสายตามตำแหน่งนี้ ถ้าสลับกัน โมเดลจะสับสน**

## โควตา ThingsBoard: ทำไมเช็กทุกวินาทีแต่ไม่ส่งครบทุกค่าทุกวินาที

ThingsBoard Cloud แผนฟรีมีลิมิตดังนี้ ([ที่มา](https://thingsboard.io/docs/paas/reference/subscriptions/))

| ลิมิต | แผนฟรี |
|---|---|
| ค่าที่ส่งได้ (data points) ต่อเดือน | 1,000,000 |
| ข้อความ (messages) ต่อเดือน | 500,000 |
| ค่าที่ส่งได้ต่ออุปกรณ์ | 100/วินาที, 2,000/นาที, 15,000/ชั่วโมง |
| Alarm ต่อเดือน | 200 |
| เก็บข้อมูลย้อนหลัง | 30 วัน |

ถ้าส่งครบ 17 ค่าทุกวินาที จะได้ 61,200 ค่าต่อชั่วโมง เกินลิมิต 15,000 ตั้งแต่นาทีที่ 15 ของทุกชั่วโมง (ข้อมูลที่เกินจะถูกตีกลับ) และโควตาทั้งเดือนจะหมดหลังนั่งรวมแค่ราว 16 ชั่วโมง

เครื่องจึงเช็กทุก 1 วินาที แต่ส่งเฉพาะค่าที่เปลี่ยน ค่าที่ไม่เปลี่ยนก็ยังโชว์ค่าล่าสุดบน dashboard ตามเดิม และมีเพดานไม่ให้ส่งเกิน 3,600 ค่าต่อชั่วโมง (`DP_BUDGET_PER_HOUR`) ซึ่งพอให้นั่งวันละ 8 ชม. ได้ทั้งเดือน ถ้าชนเพดาน ท่านั่งและการเตือนยังส่งก่อนเสมอ ค่าอื่นรอรอบถัดไป

ผลจากการจำลองบนคอม (ไม่ใช่วัดกับเครื่องจริง) นั่ง 8 ชม.: นั่งปกติใช้ราว 1,500 ค่าต่อชั่วโมง นั่งขยับตลอดราว 3,500 ค่าต่อชั่วโมง ท่านั่งใหม่ขึ้น ThingsBoard ภายใน 1.6 วินาทีทุกครั้ง ทั้งเดือนจึงใช้ราว 0.4–0.9 ล้านค่า ไม่เกินโควตา

ค่าที่ปรับได้ใน `config.h` (หมวด 5): `FULL_SNAPSHOT_SEC` ส่งครบทุกค่าทุกกี่วินาที, `FSR_DEADBAND_PCT` FSR ต้องเปลี่ยนกี่ % จึงส่ง, `DP_BUDGET_PER_HOUR` เพดานต่อชั่วโมง (ห้ามเกิน 12000)

---

## ขั้นที่ 1: ติดตั้งโปรแกรมบนคอม (ทำครั้งเดียว)

1. ดาวน์โหลดและติดตั้ง **VS Code** จาก https://code.visualstudio.com
2. เปิด VS Code → กดไอคอน Extensions ทางซ้าย (รูปสี่เหลี่ยม 4 ช่อง) → ค้นหา `PlatformIO IDE` → กด **Install** → รอจนเสร็จแล้วปิดเปิด VS Code ใหม่
3. ดาวน์โหลดโค้ดจาก GitHub: หน้า repo กดปุ่มเขียว **Code → Download ZIP** แล้วแตกไฟล์ไว้ที่ path สั้น ๆ เช่น `C:\hc\health-chair` (Windows จำกัดความยาว path) หรือใช้ `git clone` ตาม README หน้าแรก
4. ใน VS Code กดไอคอน PlatformIO (หัวมด) → **Open Project** → เลือกโฟลเดอร์ `firmware` (โฟลเดอร์ที่มีไฟล์ `platformio.ini`)
5. กดปุ่ม ✓ (Build) ที่แถบล่าง ครั้งแรกจะโหลดเครื่องมือ ESP32 นานหลายนาที รอจนขึ้น `SUCCESS`

## ขั้นที่ 2: ThingsBoard (ทำก่อน เพราะทดสอบได้เลยแม้ยังไม่มีโมเดล)

### 2.1 สมัครและสร้างอุปกรณ์
1. เข้า https://thingsboard.cloud → กด **Sign up** (สมัครด้วย Google ก็ได้) → ยืนยันอีเมล
2. เมนูซ้าย **Entities → Devices** → กด **+** มุมขวาบน → **Add new device**
3. Name: `Health Chair` → กด **Add**
4. คลิกที่แถว `Health Chair` → กด **Copy access token**

### 2.2 ใส่ค่าในโค้ดและอัปโหลด
1. ใน VS Code คลิกขวาที่ `include/secrets.example.h` → **Copy** → คลิกขวาที่โฟลเดอร์ `include` → **Paste** → เปลี่ยนชื่อไฟล์ใหม่เป็น `secrets.h` แล้วแก้
   - `WIFI_SSID` / `WIFI_PASSWORD` เป็น Wi-Fi ที่ใช้ (ต้องเป็น 2.4 GHz ถ้าใช้ hotspot มือถือ iPhone ให้เปิด "Maximize Compatibility")
   - `TB_TOKEN` วาง access token ที่ copy มา
   - ไฟล์ `secrets.h` จะไม่ถูกอัปขึ้น GitHub (กันรหัส Wi-Fi และ token รั่ว)
2. เปิด `include/config.h` เช็ก
   - `BOARD` เป็น `1` (บอร์ด kk) หรือ `2` (บอร์ดของเอ็ม)
   - `COLLECT_MODE` ให้เป็น `0`
   - ตอนทดสอบครั้งแรกที่เสียบ USB ดู Serial Monitor ให้ตั้ง `LOW_POWER 0` ก่อน (ตอนเครื่องหลับ Serial ทาง USB จะหลุด) ใช้งานจริงด้วยแบตค่อยเปลี่ยนเป็น `1`
3. เปิดสวิตช์ (J2 บอร์ด kk / SW3 บอร์ดของเอ็ม) แล้วเสียบสาย USB (ต้องเป็นสายที่ส่งข้อมูลได้ ไม่ใช่สายชาร์จอย่างเดียว) เข้าช่อง USB บนบอร์ด → กดปุ่ม → (Upload) ที่แถบล่าง
   - ESP32-S3 ต่อ USB ผ่านขา IO19/IO20 ในตัวชิป ไม่ต้องลงไดรเวอร์ USB-UART
   - ถ้าอัปโหลดไม่ได้: กดปุ่ม BOOT ค้างไว้ กด RESET หนึ่งครั้ง แล้วปล่อย BOOT จากนั้นกด Upload ใหม่
4. กดปุ่มรูปปลั๊ก (Serial Monitor) จะเห็นประมาณนี้
   ```
   Health Chair 1.4.0 | model: rules (no EI library yet) | MPU6050: OK | low power: off | realtime: on
   Battery 3.95 V
   Upload: Wi-Fi OK
   ThingsBoard connected
   Settings: muted=0 sit_limit_min=45 bad_posture_alert_sec=10 upload_interval_sec=60
   Upload: sent 1 messages
   Someone sat down -> SEATED
   [OK]  posture: upright      | seat=1.20 back=0.40 backrest=2.1 deg
   ```
   LED เขียวติดค้าง = กำลังเปิด Wi-Fi ส่งข้อมูล (ตอนเปิดเครื่อง, ตอนลุก, ตอนส่งสถานะแบต), กะพริบสั้น ๆ ทุก 3 วินาที = มีคนนั่งและเครื่องทำงานอยู่, ดับ = ไม่มีคนนั่ง (เครื่องหลับ)
   ถ้าขึ้น `Upload: Wi-Fi FAILED` หรือ `ThingsBoard failed` ดูตารางปัญหาท้ายไฟล์
4. กลับไป ThingsBoard → Devices → คลิก `Health Chair` → แท็บ **Latest telemetry** ต้องเห็นค่า `posture`, `fsr1`…`fsr6`, `battery_v` ลองนั่ง/เปลี่ยนท่า ค่า `posture` จะเปลี่ยนภายใน 1–2 วินาที

ค่าที่ส่งขึ้น ThingsBoard

| key | ความหมาย | ส่งเมื่อไร (นอกจากรอบส่งครบทุก 1 นาที) |
|---|---|---|
| `posture` | ท่านั่งปัจจุบัน (ตาม label ด้านบน หรือ `unknown`) | ทันทีที่เปลี่ยน |
| `occupied` | มีคนนั่งไหม | ทันทีที่เปลี่ยน |
| `bad_posture`, `bad_posture_sec` | กำลังนั่งผิดท่าไหม / ผิดท่ามากี่วินาทีแล้ว | ทันทีที่ท่าหรือการเตือนเปลี่ยน |
| `alert` | `none` / `bad_posture` / `sit_too_long` | ทันทีที่เปลี่ยน |
| `sit_minutes` | นั่งต่อเนื่องมากี่นาที | ทันทีที่ท่าหรือการเตือนเปลี่ยน |
| `fsr1`…`fsr6` | แรงกดแต่ละจุด 0–100 % | เมื่อเปลี่ยนเกิน 5 % |
| `backrest_deg` | พนักพิงเอนจากตอนเปิดเครื่องกี่องศา | เมื่อเปลี่ยนเกิน 2 องศา |
| `confidence`, `anomaly` | ความมั่นใจของโมเดล และคะแนนความผิดปกติ | ทุก 1 นาที |
| `battery_v`, `battery_pct` | แบตเตอรี่ | ทุก 1 นาทีตอนนั่ง, ทุก 30 นาทีตอนว่าง |

ค่า `firmware`, `model`, `mpu_ok`, `rssi` ส่งเป็น client attributes (ดูได้ในแท็บ Attributes)

### 2.3 สร้าง Dashboard
1. เมนูซ้าย **Dashboards** → **+** → **Create new dashboard** → Title: `Health Chair` → **Add**
2. กด **Add widget** (หรือ Edit mode แล้ว **+**) แล้วเพิ่มทีละตัว ทุกตัวเลือก Device = `Health Chair`
   - **Value card** (หมวด Cards) → key `posture` → ตั้งชื่อ "ท่านั่ง"
   - **Value card** → key `alert` → ชื่อ "การเตือน"
   - **Value card** → key `sit_minutes` → ชื่อ "นั่งต่อเนื่อง (นาที)"
   - **Time series chart** (หมวด Charts) → key `fsr1` ถึง `fsr6` → ชื่อ "แรงกด FSR" (จุดบนกราฟจะห่างบ้างถี่บ้างเพราะส่งเฉพาะตอนค่าเปลี่ยน เป็นเรื่องปกติ)
   - **Battery level** (หมวด Status indicators) → key `battery_pct`
   - **Alarms table** (หมวด Alarm widgets) → ใช้คู่กับข้อ 2.4
   - **Update shared boolean attribute** (หมวด Input widgets) → key `muted` → ชื่อ "ปิดเสียงเตือน"
   - **Update shared integer attribute** (หมวด Input widgets) → key `sit_limit_min` → ชื่อ "เตือนเมื่อนั่งเกิน (นาที)"
   - **Update shared integer attribute** → key `bad_posture_alert_sec` → ชื่อ "เตือนเมื่อนั่งผิดท่าเกิน (วินาที)"
3. กด **Save** มุมขวาบน
   (ชื่อหมวด widget อาจต่างไปตามเวอร์ชัน ให้พิมพ์ชื่อ widget ในช่องค้นหาได้เลย)

### 2.4 ตั้งการแจ้งเตือน (Alarm) ใน ThingsBoard
แผนฟรีสร้าง alarm ได้ 200 ครั้งต่อเดือน ถ้าตั้ง alarm ทุกครั้งที่นั่งผิดท่าจะหมดเร็ว จึงตั้ง alarm เฉพาะ "นั่งนานเกิน" กับ "แบตใกล้หมด" ส่วนการนั่งผิดท่าให้ดูจาก widget `alert` บน dashboard และเสียงเตือนที่เก้าอี้

1. เมนูซ้าย **Profiles → Device profiles** → คลิก `default` → กดรูปดินสอ (แก้ไข) → แท็บ **Alarm rules**
2. **Add alarm rule** → Alarm type: `Sit too long`
   - Create alarm rules → **+** → Severity: Warning → กดที่ช่อง condition → **Add key filter** → Key type: Time series, Key: `sit_minutes`, Value type: Numeric → Operation: greater or equal, Value: `45` → Save
   - Clear alarm rule → **+** → condition `sit_minutes` less than `45` → Save
3. **Add alarm rule** อีกอัน → Alarm type: `Low battery`
   - Create: `battery_pct` less than `15` (Severity: Major)
   - Clear: `battery_pct` greater than `20`
4. กด ✓ Save ด้านบน
5. ถ้าเปลี่ยน `sit_limit_min` บน dashboard ให้แก้เลข 45 ในข้อ 2 ให้ตรงด้วย
6. ถ้าอาจารย์อยากเห็น alarm ตอนนั่งผิดท่า: เพิ่ม rule ชื่อ `Bad posture` ใช้ `alert` equal `bad_posture` และ clear เมื่อ `alert` not equal `bad_posture` (ระวังโควตา 200 ครั้ง/เดือน ใช้ตอนสาธิตพอ)

### 2.5 ค่าตั้งที่แก้จาก dashboard (shared attributes)
ค่าที่แก้จะเก็บไว้บน ThingsBoard ตอนมีคนนั่งเครื่องต่ออยู่จึงได้ค่าใหม่ภายในราว 1 วินาที ตอนเก้าอี้ว่างเครื่องปิด Wi-Fi จะได้ค่าใหม่ตอนมีคนมานั่งหรือตอนส่งสถานะแบตรอบถัดไป (ไม่เกิน 30 นาที) และดึงใหม่ทุกครั้งที่เปิดเครื่อง

| key | ค่า | ผล |
|---|---|---|
| `muted` | `true` / `false` | ปิด/เปิดเสียง buzzer (alert ยังส่งขึ้น ThingsBoard, บอร์ด kk LED ยังเตือน) |
| `sit_limit_min` | นาที เช่น `45` | นั่งนานเท่าไรจึงเตือนให้ลุก |
| `bad_posture_alert_sec` | วินาที เช่น `10` | นั่งผิดท่านานเท่าไรจึงเตือน |
| `upload_interval_sec` | วินาที เช่น `60` | ใช้เฉพาะโหมดส่งเป็นช่วง (`REALTIME_WHILE_SEATED 0`): เปิด Wi-Fi ส่งถี่แค่ไหน |

ตั้งเองได้ที่ Devices → `Health Chair` → แท็บ **Attributes** → เลือก Shared attributes → **+**
มุมพนักพิงตั้งต้นจะจำตอนเปิดเครื่อง ให้เปิดเครื่องตอนไม่มีคนนั่งและพนักพิงอยู่ตำแหน่งปกติ

---

## ขั้นที่ 3: Edge Impulse (สอนโมเดลให้รู้จักท่านั่ง)

ในสไลด์ใช้วิธี clone โปรเจกต์ Predictive Maintenance ที่มีข้อมูลอยู่แล้ว แต่ Health Chair ต้องเก็บข้อมูลเอง ขั้นตอนหลังเก็บข้อมูลเหมือนในสไลด์ทุกอย่าง

### 3.1 สมัครและสร้างโปรเจกต์
1. เข้า https://studio.edgeimpulse.com → **Sign up** (ใช้อีเมลมหาวิทยาลัยได้) → ยืนยันอีเมล
2. กด **Create new project** → ชื่อ `Health Chair` (ใช้ชื่อนี้เป๊ะ ๆ เพราะโค้ดหาไฟล์ชื่อ `Health_Chair_inferencing.h`) → Project type: Personal → Private → **Create**
3. ตั้ง Target แบบในสไลด์ Step 2: กดปุ่ม **Target** มุมขวาบน → Target device: Custom, Processor family: ESP32, Clock rate: 240 MHz, Custom device name: `Espressif ESP32-S3` → **Save**

### 3.2 ติดตั้งตัวส่งข้อมูลจากบอร์ดเข้า Edge Impulse (ทำครั้งเดียว)
1. ติดตั้ง **Node.js LTS** จาก https://nodejs.org (ตอนติดตั้งบน Windows ให้ติ๊ก "Automatically install the necessary tools")
2. เปิด Command Prompt แล้วพิมพ์
   ```
   npm install -g edge-impulse-cli
   ```
3. ทดสอบด้วย `edge-impulse-data-forwarder --version` ถ้าขึ้นเลขเวอร์ชันแปลว่าใช้ได้

### 3.3 อัปโหลดโค้ดโหมดเก็บข้อมูล
1. เปิด `include/config.h` เปลี่ยน `#define COLLECT_MODE 1`
2. กด Upload
3. **ปิด Serial Monitor ใน VS Code** (ถ้าเปิดค้างไว้ forwarder จะใช้พอร์ตไม่ได้)
4. ตอนเปิดเครื่องอย่าขยับเก้าอี้ราว 1 วินาที (เครื่องจำทิศพนักพิงตอนตั้งตรง)

### 3.4 เชื่อมบอร์ดกับ Edge Impulse
1. Command Prompt พิมพ์
   ```
   edge-impulse-data-forwarder
   ```
2. ใส่อีเมล/รหัส Edge Impulse → เลือกโปรเจกต์ `Health Chair`
3. มันจะเจอข้อมูล 9 ค่า ที่ 20 Hz แล้วถามชื่อแกน ให้พิมพ์บรรทัดเดียวแบบนี้
   ```
   fsr1,fsr2,fsr3,fsr4,fsr5,fsr6,accX,accY,accZ
   ```
4. ตั้งชื่ออุปกรณ์ `health-chair-01`
5. กลับไปเว็บ Edge Impulse เมนู **Devices** ต้องเห็น `health-chair-01` จุดสีเขียว

### 3.5 เก็บข้อมูล
1. เมนู **Data acquisition** → ช่อง Record new data ด้านขวา
2. Device: `health-chair-01`, Sensor: (ค่าที่ขึ้นมา), Frequency: 20Hz, **Sample length: 10000** (10 วินาที)
3. Label: พิมพ์ `upright` → ให้เพื่อนนั่งท่านั้น → กด **Start sampling** → นั่งค้างท่านั้นจนครบ 10 วินาที (ขยับเล็กน้อยได้ เหมือนนั่งจริง)
4. ทำซ้ำจนได้ **อย่างน้อย 12 ครั้งต่อ label** (2 นาที) ครบทั้ง 7 label: `empty`, `upright`, `lean_forward`, `lean_back`, `lean_left`, `lean_right`, `perch`
5. ให้คนนั่งหลายคน น้ำหนักต่างกัน (อย่างน้อย 3 คน) โมเดลจะแม่นกับคนใหม่กว่า
6. ถ้าข้อมูลอยู่ใน Training ทั้งหมด: ไปที่ **Dashboard** → เลื่อนลงล่างสุด **Perform train / test split** → Yes (แบ่ง 80/20 แบบในสไลด์)

### 3.6 สร้าง Impulse (ตามสไลด์ Step 3)
1. เมนู **Impulse design → Create impulse**
2. กล่อง **Time series data**: Window size `2000` ms, Window increase (stride) `500` ms, Frequency `20` Hz
3. **Add a processing block** → เลือก **Flatten** → ติ๊กทุกแกน
   (ในสไลด์ใช้ Spectral Analysis เพราะเป็นข้อมูลการสั่นของมอเตอร์ แต่ท่านั่งเป็นแรงกดค่อนข้างนิ่ง Flatten ที่ดูค่าเฉลี่ย ต่ำสุด สูงสุด เหมาะกว่า ถ้าอาจารย์ให้ใช้ Spectral Analysis ก็เลือกแทนได้ โค้ดไม่ต้องแก้)
4. **Add a learning block** → **Classification**
5. **Add a learning block** → **Anomaly Detection (K-means)** (เหมือนในสไลด์ ใช้จับท่าแปลก ๆ ที่ไม่เคยสอน)
6. กด **Save Impulse**

### 3.7 สร้าง feature และเทรน (ตามสไลด์ Step 4)
1. เมนู **Flatten** → แท็บ Parameters ติ๊ก Average, Minimum, Maximum, RMS, Standard deviation → **Save parameters**
2. แท็บ **Generate features** → กด **Generate features** → รอจน `Job completed (success)` ดูกราฟ Feature explorer ว่าแต่ละสีแยกกลุ่มกัน
3. เมนู **Classifier** → Number of training cycles (Epochs) `30` → **Save & train** → รอผล ควรได้ Accuracy เกิน 85 % ถ้าต่ำ เก็บข้อมูลเพิ่มใน label ที่สับสน (ดูตาราง Confusion matrix)
4. เมนู **Anomaly detection** → Cluster count `32` → กด **Select suggested axes** → **Start training**
5. เมนู **Model testing** → **Classify all** ดูความแม่นกับข้อมูลชุด test (เอารูปนี้ใส่รายงานได้)

### 3.8 Deploy เป็น Arduino library (ตามสไลด์ Step 5–6)
1. เมนู **Deployment** → ช่องค้นหาพิมพ์ `Arduino library` → เลือก
2. Model optimizations: เลือก **Quantized (int8)**, Inference engine: **EON Compiler** → กด **Build** → ไฟล์ .zip จะดาวน์โหลดเอง
3. แตกไฟล์แบบในสไลด์ (กันปัญหา path ยาวบน Windows):
   1. สร้างโฟลเดอร์ `C:\ei\`
   2. ย้ายไฟล์ .zip ไป `C:\ei\` แล้วเปลี่ยนชื่อให้สั้น เช่น `hc.zip`
   3. แตกไฟล์ใน `C:\ei\` จะได้โฟลเดอร์ `Health_Chair_inferencing`
   4. ย้ายโฟลเดอร์นั้นไปไว้ใน `health-chair\lib\` ให้ได้ `lib\Health_Chair_inferencing\src\Health_Chair_inferencing.h`
4. เปิด `include/config.h` เปลี่ยนกลับเป็น `#define COLLECT_MODE 0`
5. กด Build (ครั้งแรกนาน 2–3 นาทีแบบในสไลด์ Step 7) → Upload → เปิด Serial Monitor จะเห็น
   ```
   Health Chair 1.4.0 | model: Edge Impulse | MPU6050: OK | low power: off | realtime: on
   EI window 2000 ms, 20 Hz, labels 7
   [OK]  posture: upright      | empty=0.000 lean_back=0.012 ... upright=0.951 anomaly=-0.210 (dsp 1 ms, nn 2 ms)
   [BAD] posture: lean_left    | ... lean_left=0.902 ... anomaly=0.050
   ```
   ถ้าชื่อโปรเจกต์ใน Edge Impulse ไม่ใช่ `Health Chair` ให้แก้ชื่อไฟล์ใน `src/main.cpp` บรรทัด `#if __has_include(<...>)` และ `#include <...>` ให้ตรงกับชื่อไฟล์ .h ในโฟลเดอร์ `src` ของ library
   ถ้า build ขึ้น error ว่าจำนวนแกนต้องเป็น 9 แปลว่าตอนเก็บข้อมูลแกนไม่ครบหรือลำดับไม่ตรง
   ถ้าขึ้น `WARNING: model uses ... Hz` แปลว่าความถี่ตอนเก็บข้อมูลไม่ใช่ 20 Hz ให้แก้ `SAMPLE_HZ` ใน `config.h` ให้ตรง

---

## ขั้นที่ 4: ทดสอบก่อนส่ง
1. นั่งตรง → Serial ขึ้น `[OK] upright`, dashboard ขึ้น `upright` ภายใน 1–2 วินาที
2. เอียงซ้ายค้าง 10 วินาที → LED แดงติด buzzer บี๊บ, widget `alert` ขึ้น `bad_posture`
3. นั่งตรงกลับมา → เสียงหยุดทันที (ถ้านั่งตรงไม่ถึง 3 วินาทีแล้วกลับไปเอียงอีก จะนับเวลาผิดท่าต่อจากเดิม)
4. กดสวิตช์ "ปิดเสียงเตือน" บน dashboard ขณะนั่ง → buzzer เงียบภายในราว 1 วินาที LED ยังติด
5. ตั้ง `sit_limit_min` เป็น `1` จาก dashboard (และแก้ alarm rule เป็น 1 ชั่วคราว) แล้วนั่งเกิน 1–2 นาที → บี๊บยาว + alarm `Sit too long`
6. ลุกจากเก้าอี้เกิน 1 นาที → `posture` เป็น `empty`, alarm หายเอง, LED เขียวดับ (เครื่องหลับ)

ปรับค่าได้ใน `config.h`: `MIN_CONFIDENCE` (ถ้าขึ้น `unknown` บ่อยเกินให้ลดลง), `ANOMALY_THRESHOLD` (ถ้าขึ้น `unknown` ตอนนั่งท่าปกติให้เพิ่ม), `BAD_POSTURE_ALERT_SEC`, `SIT_LIMIT_MIN`

## ปัญหาที่พบบ่อย
| อาการ | วิธีแก้ |
|---|---|
| `MPU6050: NOT FOUND` | เช็กสาย GY-521 (VCC, GND, SCL→IO41, SDA→IO39) ว่าไม่สลับ SDA/SCL |
| `ThingsBoard failed rc=5` | token ผิด copy ใหม่จากหน้า Device (เครื่องจะลองใหม่ห่างขึ้นเรื่อย ๆ สูงสุดทุก 2 นาที) |
| `failed rc=-2` | ต่อเน็ตไม่ได้หรือ DNS มีปัญหา ลองเปลี่ยน `TB_SERVER` เป็น IP `44.194.165.190` |
| Serial Monitor ไม่ขึ้นอะไรตอนไม่มีคนนั่ง | ปกติ เพราะเครื่องหลับ ตั้ง `LOW_POWER 0` ตอนดีบัก |
| `Upload: Wi-Fi FAILED` หรือ `Wi-Fi not connected, retry in ...` | ต้องเป็น 2.4 GHz และชื่อ/รหัสถูกต้อง ระหว่างนั้นข้อมูลเก็บในเครื่องได้ 10 นาที (โหมดส่งเป็นช่วง 100 นาที) เครื่องจะลองใหม่ห่างขึ้นเรื่อย ๆ เพื่อไม่ให้เปลืองแบต (ตอนนั่งสูงสุดทุก 2 นาที ตอนว่างสูงสุดทุก 1 ชม.) |
| `Battery low ... deep sleep` แล้วเครื่องเงียบ | แบตเหลือต่ำกว่า 3.30 V ชาร์จผ่าน Micro USB ที่ J10 แล้วกด RESET (หรือรอไม่เกิน 1 ชม. เครื่องตื่นเอง) |
| ค่าบน dashboard ไม่ขยับนาน ๆ | ปกติถ้าค่าไม่เปลี่ยน เครื่องส่งครบทุกค่าทุก 1 นาที ถ้าเกิน 1 นาทีแล้วยังไม่ขยับ ดู Serial ว่าต่อ ThingsBoard อยู่ไหม |
| ThingsBoard แจ้งเตือนว่าเกิน rate limit | ลด `DP_BUDGET_PER_HOUR` หรือเพิ่ม `FSR_DEADBAND_PCT` ใน `config.h` |
| FSR ขึ้น 0 ตลอด | เช็กสาย FSR และตัวต้านทาน 10k (R16–R21) |
| data forwarder บอกพอร์ตไม่ว่าง | ปิด Serial Monitor ใน VS Code ก่อน |
| data forwarder จับความถี่ไม่ได้ | ต้องตั้ง `COLLECT_MODE 1` แล้วอัปโหลดใหม่ |
