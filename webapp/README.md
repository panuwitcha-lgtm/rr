# Health Chair – Web App

แอปดูท่านั่ง สถิติ และตั้งค่าเก้าอี้ Health Chair ต่อกับ ThingsBoard Cloud โดยตรง (ไม่ต้องมีเซิร์ฟเวอร์ของตัวเอง)
ใช้ได้ทั้งคอมและมือถือ ธีมเขียว มีโหมดมืด ข้อมูลทุกหน้ามาจาก ThingsBoard (ฐานข้อมูลจริง) ไม่มีโหมดข้อมูลจำลอง

## 1. ติดตั้งและรัน

ต้องมี [Node.js](https://nodejs.org) เวอร์ชัน 18 ขึ้นไป (แนะนำ LTS)

```bash
cd health-chair-app
npm install        # ครั้งแรกครั้งเดียว
npm run dev        # เปิด http://localhost:5173
```

- เข้าสู่ระบบด้วยอีเมลและรหัสผ่านของ thingsboard.cloud ถ้ายังไม่มีเก้าอี้ ใช้ `chair_simulator.py` ส่งข้อมูลทดสอบเข้า ThingsBoard ได้
- เปิดบนมือถือในวง Wi-Fi เดียวกัน: `npm run dev -- --host` แล้วเปิด `http://<IP เครื่องคอม>:5173`

## 2. ต่อกับเก้าอี้จริง (ThingsBoard)

1. ทำตาม README ของเฟิร์มแวร์ (`firmware/health-chair/README.md`) จนเก้าอี้ส่งข้อมูลเข้า ThingsBoard ได้
2. เข้าสู่ระบบในแอปด้วย **อีเมลและรหัสผ่านเดียวกับที่ใช้เข้า thingsboard.cloud**
3. แอปจะเลือกเก้าอี้เครื่องแรกในบัญชีให้เอง ถ้ามีหลายเครื่องไปที่ **อุปกรณ์ → เปลี่ยน / เชื่อมเก้าอี้**

ถ้าจะให้คนอื่น (เช่น ผู้ใช้เก้าอี้) เข้าแอปด้วยบัญชีของเขาเอง:
1. ThingsBoard → **Customers** → Add customer (เช่น "ผู้ใช้เก้าอี้")
2. คลิก customer นั้น → **Manage users** → Add user → ใส่อีเมล → ระบบส่งลิงก์ตั้งรหัสผ่านให้
3. **Entities → Devices** → เลือกเก้าอี้ → **Assign to customer** → เลือก customer เดียวกัน

### ตั้งค่าในโค้ด (`src/config.js`)
| ค่า | ใช้ทำอะไร |
|---|---|
| `TB_URL` | ตั้งให้เองแล้ว: ตอน `npm run dev` ใช้ proxy ใน `vite.config.js` ตอน build ขึ้น GitHub Pages เรียก `https://thingsboard.cloud` ตรง ๆ ถ้าใช้ ThingsBoard เครื่องอื่นให้แก้บรรทัดนี้ |
| `DEFAULT_DEVICE_ID` | Device ID ของเก้าอี้ ปล่อยว่างได้ |
| `DEFAULTS` | ค่าเริ่มต้นของการตั้งค่า (ตรงกับ `include/config.h` ของเฟิร์มแวร์) |
| `OFFLINE_AFTER_MIN` | ไม่มีข้อมูลนานเกินกี่นาทีถือว่าออฟไลน์ (เฟิร์มแวร์ส่งทุก 30 นาทีตอนว่าง) |

ใช้ ThingsBoard เครื่องอื่น: แก้ `TB_TARGET` ใน `vite.config.js`

## 3. แอปใช้ข้อมูลอะไรจาก ThingsBoard

| ประเภท | key | ใช้ที่หน้า |
|---|---|---|
| Telemetry | `posture, occupied, bad_posture, bad_posture_sec, sit_minutes, alert` | หน้าหลัก, ท่านั่งสด, จับเวลา, แจ้งเตือน |
| Telemetry | `fsr1`–`fsr6`, `backrest_deg`, `confidence`, `anomaly` | ท่านั่งสด |
| Telemetry | `battery_v, battery_pct` | หน้าหลัก, อุปกรณ์ |
| Client attributes | `firmware, model, mpu_ok, rssi` | อุปกรณ์ |
| Shared attributes (แอปเขียน) | `muted, sit_limit_min, bad_posture_alert_sec, rest_min` | ตั้งค่าแจ้งเตือน |
| Alarms | `Sit too long`, `Low battery` | การแจ้งเตือน (กดรับทราบได้) |

REST API ที่ใช้: `/api/auth/login`, `/api/auth/user`, `/api/noauth/resetPasswordByEmail`, `/api/tenant|customer/.../deviceInfos`,
`/api/plugins/telemetry/DEVICE/{id}/values/timeseries`, `.../values/attributes/{scope}`, `.../attributes/SHARED_SCOPE`,
`/api/alarm/DEVICE/{id}`, `/api/alarm/{id}/ack` และ WebSocket `/api/ws/plugins/telemetry` สำหรับค่าสด (ถ้าต่อไม่ได้จะดึงทุก 3 วินาทีแทน)

สถิติ (เวลานั่ง, % ท่าถูก, รอบการนั่ง, คะแนน) คำนวณในแอปจาก `posture` ย้อนหลัง จึงไม่ต้องเพิ่มอะไรใน ThingsBoard
คะแนน = (% นั่งตัวตรง × 0.7) + (คะแนนลุกพัก × 0.3) โดยคะแนนลุกพักเริ่ม 100 หักรอบละ 25 เมื่อนั่งเกินเวลาที่ตั้ง

## 4. หน้าจอทั้งหมด

| รหัส | หน้า | path |
|---|---|---|
| SC-UAMS-01-01 | เข้าสู่ระบบ | `#/login` |
| SC-UAMS-01-02 | ลืมรหัสผ่าน | `#/forgot` |
| SC-UAMS-01-03 | โปรไฟล์ | `#/profile` |
| SC-UAMS-01-04 | ยืนยันออกจากระบบ | (หน้าต่างจากเมนู "ออกจากระบบ") |
| SC-SMS-01-01 | หน้าหลัก (Dashboard) | `#/` |
| SC-SMS-01-02 | ท่านั่งสด | `#/live` |
| SC-SMS-01-03 | จับเวลานั่ง/พัก | `#/timer` |
| SC-SHS-01-01 | กราฟการนั่งรายวัน | `#/stats/today` |
| SC-SHS-01-02 | ประวัติย้อนหลัง | `#/stats/history` |
| SC-SHS-01-03 | คะแนนการนั่ง | `#/stats/score` |
| SC-NTS-01-01 | รายการแจ้งเตือน | `#/notifications` |
| SC-NTS-01-02 | รายละเอียดแจ้งเตือน | `#/notifications/:id` |
| SC-DMS-01-01 | อุปกรณ์ของฉัน | `#/device` |
| SC-DMS-01-02 | เชื่อมเก้าอี้กับบัญชี | `#/device/link` |
| SC-STS-01-01 | ตั้งค่าการแจ้งเตือน | `#/settings` |
| SC-STS-01-02 | ตั้งค่าแอป | `#/settings/app` |

เปิด **ตั้งค่าแอป → แสดงรหัสหน้าจอ** เพื่อให้รหัส SC-xxx ขึ้นที่หัวทุกหน้า (ใช้ตอนแคปหน้าจอทำเอกสาร)

## 5. นำขึ้นเว็บ

```bash
npm run build      # ได้โฟลเดอร์ dist/
npm run preview    # ทดสอบไฟล์ที่ build แล้ว (ยังใช้ proxy ได้)
```
เว็บขึ้น GitHub Pages ให้อัตโนมัติทุกครั้งที่ push เข้า `main` (ไฟล์ `.github/workflows/webapp-pages.yml`) ดูขั้นตอนใน README หน้าแรกของ repo
และเบราว์เซอร์ต้องเรียก ThingsBoard ข้ามโดเมนได้ (CORS) ถ้าเรียกไม่ได้ ให้ตั้ง rewrite `/api/*` → `https://thingsboard.cloud/api/*` บนโฮสต์นั้นแทน

## 6. ข้อจำกัดที่ควรรู้
- ThingsBoard Cloud แผนฟรีเก็บข้อมูลย้อนหลัง 30 วัน หน้า "ประวัติ" จึงเลือกได้ไม่เกิน 30 วัน
- สมัครบัญชีเองในแอปไม่ได้ ผู้ดูแลต้องสร้างผู้ใช้ใน ThingsBoard
- "เวลาพัก" (`rest_min`) เป็นค่าของแอปเท่านั้น (ตรงกับ Data Element Design CFG-04) เฟิร์มแวร์ไม่ได้ใช้ แอปใช้จับเวลาพักและแนะนำ
- alarm `Sit too long` ใน ThingsBoard ตั้งไว้ 45 นาทีตาม README เฟิร์มแวร์ ถ้าเปลี่ยนเวลานั่งในแอป ควรแก้ Alarm rule ให้ตรงกัน
- แจ้งเตือนเด้งบนเครื่องได้เมื่อเปิดแอปค้างไว้ (แท็บเบื้องหลังก็ได้) ถ้าปิดแอป เก้าอี้ยังบี๊บเตือนตามปกติ

## โครงสร้างโค้ด
```
src/
  config.js            ตั้งค่า
  api/thingsboard.js   เรียก ThingsBoard REST + WebSocket
  context/             สถานะล็อกอิน ข้อมูลเก้าอี้ ธีม
  lib/stats.js         คำนวณเวลานั่ง รอบ คะแนน
  components/          Layout, ภาพท่านั่ง, แผนผังแรงกด, ปุ่ม/การ์ด
  pages/               หน้าจอทั้ง 16 หน้า
  styles.css           ธีมสี (แก้สีได้ที่ :root ด้านบนสุด)
```
