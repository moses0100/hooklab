# ทำต่อทีละส่วน

## รอบแรก — เสร็จแล้ว

- รับ webhook แบบ structured และเก็บใน SQLite
- ประวัติ 200 รายการล่าสุด, body/headers/query, ค้นหา method/ID
- ปิดบังฟิลด์ที่รู้จักก่อนบันทึก พร้อมทดสอบ HTTP และ restart

## รอบถัดไป — ขอบเขตแนะนำ

ส่งออก request ที่เลือกเป็น JSON: ใช้ข้อมูลที่ปิดบังแล้ว ตั้งชื่อไฟล์จาก ID/วันที่ และทดสอบว่าไฟล์ตรงกับรายการที่เลือก ไม่ดึง raw secrets กลับมา

## หลังจากนั้น

- ลบรายการที่เลือกพร้อมยืนยันและสถานะเมื่อรายการถูกลบจากอีกแท็บ
- เลือก response status สำหรับจำลอง webhook failure
- รองรับหลาย inbox เมื่อมีเหตุผลใช้งานจริง
- ตรวจการเชื่อมต่อจาก n8n Docker แยกจาก localhost บนเครื่อง

Public hosting, authentication และ HTTP replay ต้องออกแบบเพิ่มก่อนทำ อย่าเปิด `0.0.0.0` หรือส่ง request ซ้ำไปบริการจริงจากรุ่นทดลองนี้

## Checkpoint

มี `checkpoint/first-webhook-inbox` และ `checkpoint/v0.1-local` ใช้ `git show` ตรวจ source ก่อนย้อนงาน การกู้ควรทำใน branch/worktree ใหม่หรือ revert ด้วย commit ปกติ ไม่ reset/force push
