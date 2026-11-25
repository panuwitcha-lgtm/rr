import Icon from '../components/Icon';

// หน้าเข้าสู่ระบบ / ลืมรหัสผ่าน: ชื่อเว็บอยู่ด้านบน กล่องฟอร์มอยู่กลางจอ
export default function AuthShell({ children }) {
  return (
    <div className="auth">
      <div className="auth-box">
        <div className="auth-brand">
          <span className="brand-mark"><Icon name="chair" size={26} /></span>
          <h1>Health Chair</h1>
          <p>เก้าอี้ตรวจจับพฤติกรรมการนั่ง</p>
        </div>
        {children}
      </div>
    </div>
  );
}
