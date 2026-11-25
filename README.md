# Health Chair

เก้าอี้ตรวจจับท่านั่ง: ESP32-S3 + FSR 6 ตัว + MPU6050 → ThingsBoard Cloud → หน้าเว็บ

| โฟลเดอร์ | คืออะไร | อ่านต่อ |
|---|---|---|
| `firmware/` | เฟิร์มแวร์บอร์ดจริง (PlatformIO) | `firmware/README.md` |
| `wokwi/` | **ตัวจำลองเก้าอี้** ใน Wokwi (VS Code หรือ wokwi.com) ส่งข้อมูลขึ้น ThingsBoard ได้จริง | `wokwi/README.md` |
| `webapp/` | หน้าเว็บ Health Chair (React) ขึ้น GitHub Pages อัตโนมัติเมื่อ push เข้า `main` | `webapp/README.md` |

## ข้อมูลวิ่งยังไง

```
เก้าอี้จริง / Wokwi  --MQTT (TB_TOKEN)-->  ThingsBoard Cloud  <--ล็อกอิน--  หน้าเว็บ Health Chair
```

## เริ่มใช้กับตัวจำลอง (ประมาณ 10 นาที)

1. **ThingsBoard** (thingsboard.cloud): Entities → Devices → **+ Add new device** ชื่อ `Health Chair Sim` → กดที่ device → **Copy access token**
2. **Wokwi**: เปิดโฟลเดอร์ `wokwi/` ใน VS Code → วาง token ที่ `TB_TOKEN` ใน `wokwi/src/config.h` → PlatformIO **Build** → F1 `Wokwi: Start Simulator`
3. ดู Terminal ต้องขึ้น `>> เชื่อม ThingsBoard สำเร็จ` และ `ส่งไป N ข้อความ` ที่ N เพิ่มขึ้นเรื่อย ๆ
4. **หน้าเว็บ**: ล็อกอินด้วย**บัญชี ThingsBoard เดียวกับที่สร้าง device ในข้อ 1**
   เว็บจะเลือกเครื่องที่กำลังออนไลน์ให้เอง ถ้ายังเป็นเครื่องอื่น ไปที่ **อุปกรณ์ → เปลี่ยน / เชื่อมเก้าอี้**
5. เลื่อน slide ใน Wokwi (เช่น เอียงซ้าย 70, 10, 70, 10) แล้วดูหน้าเว็บเปลี่ยนตาม

## เว็บไม่ขึ้นข้อมูล

| อาการบนหน้าเว็บ | สาเหตุ / วิธีแก้ |
|---|---|
| `Invalid UUID string: deviceInfos` | เว็บเวอร์ชันเก่า ใช้ endpoint ที่ ThingsBoard Cloud ไม่มี → **แก้แล้วในชุดนี้** (`webapp/src/api/thingsboard.js`) push ขึ้น `main` แล้วรอ GitHub Pages build ใหม่ 2-3 นาที |
| `บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้` หรือ `ยังไม่มีเก้าอี้ในบัญชีนี้` | บัญชีที่ล็อกอินมองไม่เห็น device → ล็อกอินด้วยบัญชีเจ้าของ device หรือให้เจ้าของบัญชีเพิ่มสิทธิ์อ่านอุปกรณ์ให้ (ThingsBoard → Users / User groups → Roles) |
| ทุกค่าเป็น 0 และแบตขึ้น `ออฟไลน์ · -` | device ที่เว็บเลือกไม่เคยได้รับข้อมูล → เช็ก Terminal ของ Wokwi ว่าเชื่อม ThingsBoard ได้ไหม และ token ตรงกับ device ที่เว็บเลือก (ดูชื่อที่หน้า **อุปกรณ์**) |

## สิ่งที่เปลี่ยนในชุดนี้

- `webapp/src/api/thingsboard.js`: หารายการเก้าอี้ได้บน ThingsBoard Cloud (ลอง `/api/deviceInfos/all` ก่อน แล้วค่อยลองแบบเดิม)
- `webapp/src/context/DataContext.jsx`: ถ้ายังไม่ได้เลือกเครื่อง เลือกเครื่องที่กำลังออนไลน์ก่อน
- `wokwi/`: ย้ายตัวจำลองเข้ามาใน repo ใช้กับ VS Code (PlatformIO + Wokwi) ได้เลย, Terminal เป็นภาษาไทยบอกท่านั่ง น้ำหนักซ้าย/ขวา/หน้า/หลังเป็น % และสถานะ ThingsBoard, slide เริ่มที่ท่านั่งตรง
- `.gitignore`: กัน `wokwi/.pio/`
