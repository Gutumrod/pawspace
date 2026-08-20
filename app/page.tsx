"use client";

import { useMemo, useState } from "react";

type Status = "available" | "occupied" | "cleaning" | "maintenance";
type Room = { id: string; number: string; type: string; status: Status; pet?: string; species?: "dog" | "cat"; owner?: string; checkout?: string; note?: string; report?: boolean };
type Report = { food: string; toilet: string; mood: string; note: string };

const statusMeta: Record<Status, { label: string; chip: string; dot: string }> = {
  occupied: { label: "มีสัตว์พัก", chip: "chip-occupied", dot: "#4e9cd8" },
  available: { label: "ว่าง", chip: "chip-available", dot: "#55b87d" },
  cleaning: { label: "รอทำความสะอาด", chip: "chip-cleaning", dot: "#e4a039" },
  maintenance: { label: "ปิดปรับปรุง", chip: "chip-maintenance", dot: "#87959c" },
};

const initialRooms: Room[] = [
  { id: "r1", number: "A01", type: "Standard", status: "occupied", pet: "Milo", species: "dog", owner: "คุณแป้ง", checkout: "20 ส.ค.", note: "แพ้อาหารไก่", report: true },
  { id: "r2", number: "A02", type: "Standard", status: "available" },
  { id: "r3", number: "A03", type: "Deluxe", status: "occupied", pet: "Luna", species: "cat", owner: "คุณกอล์ฟ", checkout: "21 ส.ค.", report: false },
  { id: "r4", number: "A04", type: "VIP", status: "cleaning", note: "กำลังพ่นฆ่าเชื้อ" },
  { id: "r5", number: "B01", type: "Standard", status: "occupied", pet: "โบโบ้", species: "dog", owner: "คุณมุก", checkout: "22 ส.ค.", report: true },
  { id: "r6", number: "B02", type: "Deluxe", status: "available" },
  { id: "r7", number: "B03", type: "VIP", status: "occupied", pet: "Tofu", species: "cat", owner: "คุณเอิร์ธ", checkout: "24 ส.ค.", note: "ให้ยาหลังอาหาร", report: false },
  { id: "r8", number: "B04", type: "Standard", status: "maintenance", note: "รอเปลี่ยนหลอดไฟ" },
  { id: "r9", number: "C01", type: "Cat Condo", status: "occupied", pet: "ซูกัส", species: "cat", owner: "คุณนัท", checkout: "23 ส.ค.", report: true },
  { id: "r10", number: "C02", type: "Cat Condo", status: "available" },
  { id: "r11", number: "C03", type: "Deluxe", status: "occupied", pet: "พุดดิ้ง", species: "dog", owner: "คุณแพรว", checkout: "25 ส.ค.", report: false },
  { id: "r12", number: "C04", type: "Standard", status: "available" },
];

const arrivals = [
  ["10:30", "น้องมะลิ", "คุณฟ้า", "A02", "🐕"],
  ["13:00", "น้องจิ๋ว", "คุณโอ๋", "B02", "🐈"],
  ["15:45", "น้องชูใจ", "คุณตาล", "C02", "🐕"],
];

const activity = [
  ["09:42", "ส่ง Daily Report สำเร็จ", "Milo · ห้อง A01", "#55b87d"],
  ["09:18", "เช็คอินสำเร็จ", "Tofu · ห้อง B03", "#4e9cd8"],
  ["08:56", "ห้องพร้อมใช้งาน", "A04 ทำความสะอาดแล้ว", "#e4a039"],
];

const reportOptions = {
  food: ["กินหมด", "กินครึ่งเดียว", "กินน้อย", "ไม่ยอมกิน"],
  toilet: ["ปกติ", "ถ่ายเหลว", "ไม่ถ่าย"],
  mood: ["ร่าเริง", "สงบ", "เครียด/คิดถึงบ้าน"],
};

export default function Home() {
  const [rooms, setRooms] = useState(initialRooms);
  const [query, setQuery] = useState("");
  const [activeNav, setActiveNav] = useState("ภาพรวม");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [report, setReport] = useState<Report>({ food: "กินหมด", toilet: "ปกติ", mood: "ร่าเริง", note: "วันนี้น้องอารมณ์ดี วิ่งเล่นและทานอาหารได้ตามปกติครับ" });
  const [toast, setToast] = useState("");

  const filteredRooms = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return rooms;
    return rooms.filter((room) => [room.number, room.type, room.pet, room.owner].some((field) => field?.toLowerCase().includes(value)));
  }, [rooms, query]);

  const occupied = rooms.filter((room) => room.status === "occupied");
  const reportCount = occupied.filter((room) => room.report).length;
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2400); };
  const chooseOption = (key: keyof Report, value: string) => setReport((current) => ({ ...current, [key]: value }));
  const saveReport = () => {
    if (!selectedRoom) return;
    setRooms((current) => current.map((room) => room.id === selectedRoom.id ? { ...room, report: true } : room));
    setSelectedRoom(null);
    showToast("บันทึก Daily Report ในโหมด preview แล้ว");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">P</div><div className="brand-copy"><div className="brand-name">PawSpace</div><div className="brand-caption">PET HOTEL OPERATIONS</div></div></div>
        <div className="nav-label">Workspace</div>
        <nav className="nav-list" aria-label="เมนูหลัก">
          {["ภาพรวม", "ผังห้องพัก", "การจอง", "ลูกค้า & สัตว์เลี้ยง", "รายงาน & Analytics", "ตั้งค่าร้าน"].map((item, index) => (
            <button key={item} className={`nav-item ${activeNav === item ? "active" : ""}`} onClick={() => { setActiveNav(item); if (item !== "ภาพรวม") showToast("หน้านี้อยู่ใน roadmap ของ PawSpace"); }}><span className="nav-icon">{["⌂", "▦", "◷", "♙", "⌁", "⚙"][index]}</span><span>{item}</span></button>
          ))}
        </nav>
        <div className="sidebar-bottom"><div className="shop-card"><div className="shop-name">บ้านน้องหมา Pet Hotel</div><div className="shop-detail">กรุงเทพฯ · สาขาเดียว</div><div className="shop-detail"><span className="sync-dot" />ระบบทำงานปกติ</div></div></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><div className="eyebrow">พุธ 20 สิงหาคม 2569 · วันนี้</div><h1 className="page-title">ภาพรวมการดำเนินงาน</h1><div className="page-subtitle">จัดการห้องพัก เช็คอิน และ Daily Care Report จากหน้าจอเดียว</div></div>
          <div className="header-actions"><input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาห้อง, ชื่อสัตว์ หรือเจ้าของ..." aria-label="ค้นหาห้อง" /><button className="icon-button" onClick={() => showToast("การแจ้งเตือนทั้งหมดถูกอ่านแล้ว")} aria-label="การแจ้งเตือน">♢</button><button className="primary-button" onClick={() => showToast("ฟอร์มสร้างการจองจะเปิดหลังเชื่อมฐานข้อมูลจริง")}>+ สร้างการจอง</button><div className="avatar" aria-label="ผู้ใช้งาน พี่มีน">ม</div></div>
        </header>

        <section className="kpi-grid" aria-label="สถิติวันนี้">
          <div className="card kpi-card"><div className="kpi-label">ห้องที่มีสัตว์พัก</div><strong className="kpi-value">{occupied.length}<small style={{ fontSize: 15, color: "#71807a" }}> / {rooms.length}</small></strong><div className="kpi-meta">อัตราเข้าพัก {Math.round((occupied.length / rooms.length) * 100)}%</div></div>
          <div className="card kpi-card"><div className="kpi-label">Daily Report ที่ส่งแล้ว</div><strong className="kpi-value">{reportCount}<small style={{ fontSize: 15, color: "#71807a" }}> / {occupied.length}</small></strong><div className="kpi-meta">อัปเดตเมื่อสักครู่</div></div>
          <div className="card kpi-card"><div className="kpi-label">เช็คอินวันนี้</div><strong className="kpi-value">6</strong><div className="kpi-meta">+2 จากเมื่อวาน</div></div>
          <div className="card kpi-card"><div className="kpi-label">Google Sheets</div><strong className="kpi-value" style={{ fontSize: 20, marginTop: 15 }}>ซิงก์แล้ว</strong><div className="kpi-meta">Record_ID ปกติ</div></div>
        </section>

        <section className="section-grid">
          <div className="card panel"><div className="panel-header"><div><h2 className="panel-title">ผังห้องพักวันนี้</h2><div className="panel-subtitle">คลิกห้องเพื่อดูข้อมูลและส่ง Daily Care Report</div></div><div className="status-legend">{(Object.keys(statusMeta) as Status[]).map((status) => <span className="legend" key={status}><span className="legend-dot" style={{ background: statusMeta[status].dot }} />{statusMeta[status].label}</span>)}</div></div><div className="room-grid">{filteredRooms.map((room) => { const meta = statusMeta[room.status]; return <button className="room-card" key={room.id} onClick={() => room.status === "occupied" ? setSelectedRoom(room) : showToast(room.note ?? meta.label)}><div className="room-top"><div><div className="room-number">{room.number}</div><div className="room-type">{room.type}</div></div><span className={`status-chip ${meta.chip}`}><span className="legend-dot" style={{ background: meta.dot }} />{meta.label}</span></div><div className={`room-pet ${room.pet ? "" : "empty"}`}>{room.pet ? <>{room.species === "cat" ? "🐈" : "🐕"} {room.pet}</> : "ไม่มีสัตว์พัก"}</div>{room.note && <div className="room-note">{room.note}</div>}{room.checkout && <div className="room-note">เช็คเอาท์ {room.checkout} · {room.report ? "Report แล้ว" : "รอส่ง Report"}</div>}</button>; })}</div>{filteredRooms.length === 0 && <div className="demo-note">ไม่พบห้องที่ตรงกับการค้นหา</div>}</div>
          <div className="card panel"><div className="panel-header"><div><h2 className="panel-title">เช็คอินที่กำลังจะมาถึง</h2><div className="panel-subtitle">วันนี้ · 3 รายการ</div></div><button className="secondary-button" onClick={() => showToast("เปิดปฏิทินการจองใน roadmap")}>ดูทั้งหมด</button></div><div className="arrival-list">{arrivals.map(([time, name, owner, room, emoji]) => <div className="arrival" key={time}><div className="arrival-time">{time}</div><div><div className="arrival-name">{emoji} {name}</div><div className="arrival-owner">{owner}</div></div><div className="room-tag">{room}</div></div>)}</div><div className="demo-note">ระบบจริงจะตรวจสอบช่วงเวลาและห้องว่างด้วย transaction ที่ฐานข้อมูล เพื่อป้องกัน double booking</div></div>
        </section>

        <section className="bottom-grid">
          <div className="card panel"><div className="panel-header"><div><h2 className="panel-title">Daily Care Report</h2><div className="panel-subtitle">ความคืบหน้าการอัปเดตเจ้าของสัตว์วันนี้</div></div><button className="secondary-button" onClick={() => { const first = occupied.find((room) => !room.report) ?? occupied[0]; setSelectedRoom(first); }}>ส่งรายงาน</button></div><div className="report-progress"><div className="progress-ring" style={{ background: `conic-gradient(var(--coral) 0 ${occupied.length ? Math.round((reportCount / occupied.length) * 100) : 0}%, #f0e9e5 0 100%)` }}><strong>{occupied.length ? Math.round((reportCount / occupied.length) * 100) : 0}%</strong></div><div className="progress-copy"><strong>{reportCount} จาก {occupied.length} ห้องส่งแล้ว</strong><span>กดการ์ดห้องที่มีสัตว์พักเพื่อเขียนรายงาน<br />พร้อมรูปและข้อความสำหรับ LINE</span></div></div></div>
          <div className="card panel"><div className="panel-header"><div><h2 className="panel-title">กิจกรรมล่าสุด</h2><div className="panel-subtitle">บันทึกจากหน้าร้าน</div></div></div><div className="activity-list">{activity.map(([time, title, detail, color]) => <div className="activity-row" key={time}><span className="activity-dot" style={{ background: color }} /><div><div className="activity-title">{title}</div><div className="activity-detail">{detail}</div></div><div className="activity-time">{time}</div></div>)}</div></div>
        </section>

        <div className="demo-note" style={{ marginTop: 14 }}>Preview mode · ข้อมูลตัวอย่างยังไม่ส่งไปยัง LINE หรือ Google Sheets จริง · Supabase migration พร้อมเชื่อมต่อ</div>
      </main>

      {selectedRoom && <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRoom(null); }}><aside className="drawer" role="dialog" aria-modal="true" aria-label={`Daily Report ${selectedRoom.pet ?? selectedRoom.number}`}><div className="drawer-header"><div><div className="eyebrow">ห้อง {selectedRoom.number} · {selectedRoom.type}</div><h2 className="drawer-title">Daily Report · {selectedRoom.pet}</h2><div className="panel-subtitle">{selectedRoom.owner} · เช็คเอาท์ {selectedRoom.checkout}</div></div><button className="icon-button" onClick={() => setSelectedRoom(null)} aria-label="ปิด">×</button></div><div className="drawer-section"><h3>การกิน</h3><div className="option-grid">{reportOptions.food.map((option) => <button key={option} className={`option ${report.food === option ? "selected" : ""}`} onClick={() => chooseOption("food", option)}>{option}</button>)}</div></div><div className="drawer-section"><h3>การขับถ่าย</h3><div className="option-grid">{reportOptions.toilet.map((option) => <button key={option} className={`option ${report.toilet === option ? "selected" : ""}`} onClick={() => chooseOption("toilet", option)}>{option}</button>)}</div></div><div className="drawer-section"><h3>อารมณ์</h3><div className="option-grid">{reportOptions.mood.map((option) => <button key={option} className={`option ${report.mood === option ? "selected" : ""}`} onClick={() => chooseOption("mood", option)}>{option}</button>)}</div></div><div className="drawer-section"><h3>ข้อความถึงเจ้าของ</h3><textarea className="note-input" value={report.note} onChange={(event) => setReport((current) => ({ ...current, note: event.target.value }))} /></div><div className="demo-note">รูปภาพ, LINE Flex Message และ delivery log จะเชื่อมผ่าน adapter หลังใส่ credentials ของร้าน</div><div className="drawer-actions"><button className="secondary-button" onClick={() => { setSelectedRoom(null); showToast("ปิดหน้าต่างโดยไม่บันทึก"); }}>ยกเลิก</button><button className="primary-button" onClick={saveReport}>บันทึก Report</button></div></aside></div>}
      {toast && <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#173f36", color: "white", padding: "11px 16px", borderRadius: 10, fontSize: 12, zIndex: 30, boxShadow: "0 10px 24px rgba(20,35,31,.18)" }} role="status">{toast}</div>}
    </div>
  );
}
