import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Clock3, Database, ExternalLink, HardDrive, LayoutDashboard, LogOut, Moon, RefreshCw, Settings2, ShieldCheck, Sun, Trash2, SquarePlay as Youtube } from 'lucide-react';
import './AdminView.css';

const NAV = [
  ['', 'Tổng quan', LayoutDashboard], ['storage', 'Dung lượng & video', HardDrive],
  ['jobs', 'Tác vụ & lỗi', Activity], ['youtube', 'Kết nối YouTube', Youtube],
  ['settings', 'Cấu hình', Settings2], ['audit', 'Nhật ký quản trị', Clock3],
];
const STATUS = { queued: 'Đang chờ', running: 'Đang xử lý', completed: 'Hoàn thành', failed: 'Thất bại', interrupted: 'Gián đoạn', recording: 'Bản ghi gốc', processing: 'Đang xử lý' };
const ERROR = { signup_required: 'Tài khoản chưa có kênh YouTube', token_expired: 'Cần kết nối lại Google', permission_denied: 'Thiếu quyền YouTube', quota_exceeded: 'Hết hạn mức API YouTube', network_error: 'Lỗi kết nối mạng', disk_full: 'Không đủ dung lượng', worker_restarted: 'Worker đã khởi động lại', not_connected: 'Chưa kết nối YouTube' };
const formatBytes = bytes => `${((bytes || 0) / 1024 ** 3).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} GiB`;
const formatTime = value => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa cập nhật';

function Badge({ status }) { return <span className={`admin-badge ${status}`}>{STATUS[status] || status}</span>; }
function Empty({ children }) { return <div className="admin-empty"><Database size={28} /><p>{children}</p></div>; }

function JobsTable({ jobs, action, busy }) {
  if (!jobs.length) return <Empty>Chưa có tác vụ. Chọn video để tổng hợp hoặc đồng bộ YouTube.</Empty>;
  return <div className="admin-table-scroll"><table><thead><tr><th>Tác vụ</th><th>Trạng thái / tiến độ</th><th>Cập nhật cuối</th><th>Thao tác</th></tr></thead><tbody>{jobs.map(job => <tr key={job.id}>
    <td><strong>{job.kind === 'merge' ? 'Tổng hợp video' : 'Đồng bộ YouTube'}</strong><small>{job.payload.date || 'Các ngày đủ điều kiện'} · {job.payload.stream || 'Tất cả máy'}</small></td>
    <td><Badge status={job.status} /><small>{ERROR[job.error_code] || job.error_code}</small><p className="admin-job-message">{job.message}</p><progress max="100" value={job.progress} aria-label="Tiến độ tác vụ" /></td>
    <td className="admin-nowrap">{formatTime(job.updated_at)}</td>
    <td>{['failed', 'interrupted'].includes(job.status) && <button disabled={busy} onClick={() => action(`/jobs/${job.id}/retry`, {})}><RefreshCw size={15} />Thử lại</button>}</td>
  </tr>)}</tbody></table></div>;
}

function StorageView({ inventory, action, preview, busy, jobs }) {
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const rows = inventory.rows.map(row => {
    const latest = jobs.find(job => job.kind === 'merge' && job.payload.date === row.date);
    return row.status === 'processing' && latest && ['failed', 'interrupted'].includes(latest.status)
      ? { ...row, status: latest.status, error: latest.message } : row;
  }).filter(row => `${row.date} ${row.stream} ${row.name}`.toLowerCase().includes(filter.toLowerCase()) && (status === 'all' || (status === 'error' ? row.error || ['failed', 'interrupted'].includes(row.status) : status === 'youtube' ? row.youtube_url : !row.youtube_url)));
  const blocked = jobs.some(job => ['queued', 'running'].includes(job.status));
  return <>
    <div className="admin-toolbar"><label className="admin-search"><span>Tìm ngày hoặc máy</span><input value={filter} onChange={event => setFilter(event.target.value)} placeholder="2026-10-12, team2-2…" /></label><label><span>Trạng thái lưu trữ</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Tất cả</option><option value="error">Có lỗi / gián đoạn</option><option value="local">Chưa có YouTube</option><option value="youtube">Đã có YouTube</option></select></label><button disabled={busy || inventory.scanning} onClick={() => action('/inventory', {})}><RefreshCw size={16} />{inventory.scanning ? 'Đang kiểm kê…' : 'Kiểm kê lại'}</button></div>
    <p className="admin-muted">{rows.length} máy · Kiểm kê {formatTime(inventory.updated_at ? inventory.updated_at * 1000 : null)}. Không xóa video đang ghi hoặc đang xử lý.</p>
    {inventory.error && <div className="admin-alert danger">Không thể kiểm kê: {inventory.error}</div>}
    {!rows.length ? <Empty>{inventory.scanning ? 'Đang kiểm kê dữ liệu trên ổ lưu trữ…' : 'Không có video khớp bộ lọc.'}</Empty> : <div className="admin-table-scroll"><table><thead><tr><th>Ngày / máy</th><th>FLV gốc</th><th>HLS</th><th>MP4</th><th>File tạm</th><th>Trạng thái</th><th>Chi tiết</th></tr></thead><tbody>{rows.map(row => <tr key={`${row.date}-${row.stream}`}>
      <td><strong>{row.name}</strong><small>{row.date} · {row.stream}</small></td><td>{formatBytes(row.raw_bytes)}<small>{row.raw_count} file{row.missing_count > 0 ? ` · thiếu ${row.missing_count}` : ''}</small></td><td>{formatBytes(row.hls_bytes)}</td><td>{formatBytes(row.mp4_bytes)}</td><td>{formatBytes(row.temp_bytes)}</td><td><Badge status={row.status} />{row.youtube_url && <a className="admin-text-link" href={row.youtube_url} target="_blank" rel="noreferrer">YouTube <ExternalLink size={13} /></a>}{row.error && <small className="admin-error-text">Có lỗi cần kiểm tra</small>}</td><td><button aria-label={`Chi tiết ${row.stream} ngày ${row.date}`} onClick={() => setSelected(row)}><ChevronRight size={17} /></button></td>
    </tr>)}</tbody></table></div>}
    {selected && <div className="admin-detail"><div className="admin-section-heading"><div><h2>{selected.name} · {selected.date}</h2><p className="admin-muted">{selected.stream} · {selected.raw_count} bản ghi gốc</p></div><button onClick={() => setSelected(null)}>Đóng chi tiết</button></div>{selected.error && <div className="admin-alert danger">{selected.error}</div>}<div className="admin-actions"><button disabled={busy || blocked || !selected.raw_count} onClick={() => action('/jobs', { kind: 'merge', date: selected.date, stream: selected.stream })}><RefreshCw size={16} />Tổng hợp lại</button><button disabled={busy || blocked || !selected.hls_bytes || !!selected.youtube_url} onClick={() => action('/jobs', { kind: 'youtube', date: selected.date, stream: selected.stream })}><Youtube size={16} />Đồng bộ YouTube</button>{[['temporary', 'Dọn file tạm'], ['raw', 'Xóa FLV gốc'], ['replay', 'Xóa replay local']].map(([category, label]) => <button key={category} disabled={busy || blocked} className="admin-danger-button" onClick={() => preview({ date: selected.date, stream: selected.stream, category })}><Trash2 size={15} />{label}</button>)}</div><p className="admin-muted">Xóa dữ liệu luôn yêu cầu xem trước danh sách file và xác nhận.</p></div>}
  </>;
}

function SettingsForm({ values, action, busy }) {
  const [form, setForm] = useState(values);
  return <form className="admin-form admin-settings" onSubmit={event => { event.preventDefault(); action('/settings', form, 'PUT'); }}>
    <h2>Giới hạn dung lượng</h2><div className="admin-form-row"><label>Cảnh báo (%)<input type="number" min="1" max="98" required value={form.warning_percent} onChange={event => setForm({ ...form, warning_percent: Number(event.target.value) })} /></label><label>Nguy cấp (%)<input type="number" min="2" max="99" required value={form.critical_percent} onChange={event => setForm({ ...form, critical_percent: Number(event.target.value) })} /></label></div>
    <h2>Lịch đồng bộ YouTube</h2><label className="admin-checkbox"><input type="checkbox" checked={form.sync_enabled} onChange={event => setForm({ ...form, sync_enabled: event.target.checked })} />Bật đồng bộ tự động các bản ghi cũ hơn 7 ngày</label><label>Thời gian (giờ Việt Nam)<input type="time" required value={form.sync_time} onChange={event => setForm({ ...form, sync_time: event.target.value })} /></label><div className="admin-alert">Video local được giữ lại kể cả khi upload thành công. File tạm của tác vụ đã kết thúc được tự dọn khi an toàn.</div><button className="admin-primary" disabled={busy} type="submit">Lưu cấu hình</button>
  </form>;
}

export default function AdminView({ darkMode, toggleTheme }) {
  const location = useLocation();
  const section = location.pathname.replace(/^\/admin\/?/, '') || '';
  const [session, setSession] = useState(undefined);
  const [password, setPassword] = useState('');
  const [data, setData] = useState(null);
  const [youtube, setYoutube] = useState(null);
  const [audit, setAudit] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [cleanup, setCleanup] = useState(null);
  const csrf = useRef('');
  const dialog = useRef(null);

  const api = useCallback(async (path, body, method = 'POST') => {
    const response = await fetch(`/api/v1/admin${path}`, { method: body === undefined ? 'GET' : method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.current }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json().catch(() => ({ error: 'Máy chủ trả về dữ liệu không hợp lệ.' }));
    if (!response.ok) {
      if (response.status === 401 && path !== '/session') setSession(null);
      const error = new Error(result.error || 'Không thể thực hiện thao tác.');
      error.status = response.status;
      throw error;
    }
    return result;
  }, []);

  const reload = useCallback(async () => {
    const [overview, connection] = await Promise.all([api('/overview'), api('/youtube/status')]);
    setData(overview); setYoutube(connection);
  }, [api]);

  useEffect(() => {
    let alive = true;
    api('/session').then(result => { if (alive) { csrf.current = result.csrf; setSession(result); } }).catch(error => { if (alive) { setSession(null); if (error.status !== 401) setError(error.message); } });
    return () => { alive = false; };
  }, [api]);

  useEffect(() => {
    if (!session) return;
    const update = () => reload().catch(error => setError(error.message));
    update();
    const timer = setInterval(update, 10000);
    return () => clearInterval(timer);
  }, [session, reload]);

  useEffect(() => {
    if (session && section === 'audit') api('/audit').then(setAudit).catch(error => setError(error.message));
  }, [session, section, api]);

  useEffect(() => { if (cleanup) dialog.current?.showModal(); }, [cleanup]);

  async function action(path, body, method) {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api(path, body, method);
      if (result.url) { window.location.assign(result.url); return; }
      if (path === '/session' && method === 'DELETE') { csrf.current = ''; setSession(null); setData(null); return; }
      await reload();
      setNotice(path.includes('/jobs') ? 'Đã đưa tác vụ vào hàng đợi.' : 'Đã cập nhật thành công.');
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }

  async function preview(body) {
    setBusy(true); setError('');
    try { setCleanup(await api('/cleanup/preview', body)); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }

  async function signIn(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const result = await api('/session', { password }); csrf.current = result.csrf; setSession(result); setPassword(''); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }

  if (session === undefined) return <div className="admin-loading" role="status">Đang kiểm tra phiên quản trị…</div>;
  if (!session) return <div className="admin-login"><Link to="/" className="admin-back"><ArrowLeft size={16} />Về trang xem trực tiếp</Link><form onSubmit={signIn} className="admin-login-form"><ShieldCheck size={36} /><p className="admin-eyebrow">BP AOE / VẬN HÀNH</p><h1>Đăng nhập quản trị</h1><p className="admin-muted">Quản lý video, dung lượng lưu trữ và kết nối YouTube.</p><label>Mật khẩu quản trị<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} autoFocus /></label>{error && <div className="admin-alert danger" role="alert">{error}</div>}<button type="submit" className="admin-primary" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button><small>Phiên đăng nhập có hiệu lực 8 giờ.</small></form></div>;

  const title = NAV.find(([key]) => key === section)?.[1] || 'Không tìm thấy trang';
  const disk = data?.storage;
  const jobs = data?.jobs || [];
  const running = jobs.filter(job => ['queued', 'running'].includes(job.status));
  const failed = jobs.filter(job => ['failed', 'interrupted'].includes(job.status));
  const level = disk && disk.percent >= data.settings.critical_percent ? 'danger' : disk && disk.percent >= data.settings.warning_percent ? 'warning' : 'good';
  return <div className="admin-shell"><aside className="admin-sidebar"><Link to="/admin" className="admin-brand"><ShieldCheck size={25} /><div>BP AOE<small>TRUNG TÂM VẬN HÀNH</small></div></Link><nav aria-label="Quản trị">{NAV.map(([key, label, icon]) => { const Icon = icon; return <NavLink key={key} to={`/admin${key ? `/${key}` : ''}`} end><Icon size={18} />{label}</NavLink>; })}</nav><div className="admin-sidebar-footer"><Link to="/"><ArrowLeft size={17} />Về website</Link><button onClick={toggleTheme}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}{darkMode ? 'Giao diện sáng' : 'Giao diện tối'}</button><button disabled={busy} onClick={() => action('/session', {}, 'DELETE')}><LogOut size={17} />Đăng xuất</button></div></aside>
    <main className="admin-main"><header className="admin-header"><div><p className="admin-eyebrow">QUẢN TRỊ HỆ THỐNG</p><h1>{title}</h1><p className="admin-muted">Giữ dữ liệu an toàn. Theo dõi và xử lý vấn đề tại một nơi.</p></div><span className="admin-session"><ShieldCheck size={15} />Quản trị viên</span></header>
      {error && <div className="admin-alert danger" role="alert"><AlertTriangle size={18} /><span>{error}</span><button onClick={() => setError('')}>Đóng</button></div>}{notice && <div className="admin-alert good" role="status"><CheckCircle2 size={18} />{notice}</div>}
      {!data ? <Empty>Đang tải thông tin hệ thống…</Empty> : <>
      {section === '' && <><div className={`admin-storage-banner ${level}`}><div><HardDrive size={23} /><h2>{level === 'danger' ? 'Dung lượng ở mức nguy cấp' : level === 'warning' ? 'Dung lượng cần chú ý' : 'Dung lượng lưu trữ'}</h2></div><strong>{disk.percent}% <span>đã sử dụng</span></strong><progress max="100" value={disk.percent} aria-label="Dung lượng đã sử dụng" /><p>{formatBytes(disk.used)} / {formatBytes(disk.total)} · Còn trống <b>{formatBytes(disk.free)}</b></p><Link to="/admin/storage">Kiểm tra và dọn dữ liệu <ChevronRight size={17} /></Link></div>
      <div className="admin-metrics"><div><Activity size={20} /><small>Tác vụ đang chờ / chạy</small><strong>{running.length}</strong></div><div><AlertTriangle size={20} /><small>Tác vụ lỗi / gián đoạn</small><strong>{failed.length}</strong></div><div><Database size={20} /><small>Máy được kiểm kê</small><strong>{data.inventory.rows.length}</strong></div><div><Youtube size={20} /><small>YouTube</small><strong className="admin-metric-text">{youtube?.connected ? 'Đã kết nối' : 'Cần kiểm tra'}</strong></div></div>
      {!youtube?.connected && <div className="admin-alert warning"><Youtube size={20} /><span>{ERROR[youtube?.code] || 'Kết nối YouTube để đồng bộ video. Replay local sẽ được giữ lại khi có lỗi.'}</span><Link to="/admin/youtube">Xử lý kết nối <ChevronRight size={15} /></Link></div>}
      <div className="admin-section-heading"><h2>Tác vụ gần đây</h2><Link to="/admin/jobs">Xem tất cả</Link></div><JobsTable jobs={jobs.slice(0, 5)} action={action} busy={busy} /></>}
      {section === 'storage' && <StorageView inventory={data.inventory} action={action} preview={preview} busy={busy} jobs={jobs} />}
      {section === 'jobs' && <><div className="admin-alert">Mỗi lần chỉ chạy một tác vụ xử lý video. Tác vụ gián đoạn giữ nguyên bản ghi gốc để thử lại.</div><JobsTable jobs={jobs} action={action} busy={busy} /></>}
      {section === 'youtube' && <div className="admin-youtube"><div className="admin-connection"><Youtube size={36} /><div><h2>{youtube?.connected ? youtube.channel.title : ERROR[youtube?.code] || 'Chưa xác minh kết nối YouTube'}</h2><p className="admin-muted">Kiểm tra lần cuối: {formatTime(youtube?.checked_at)}</p>{youtube?.channel && <a href={youtube.channel.url} target="_blank" rel="noreferrer" className="admin-text-link">Mở kênh YouTube <ExternalLink size={15} /></a>}</div></div>{youtube?.error && <div className="admin-alert danger">{youtube.error}</div>}<div className="admin-actions"><button disabled={busy || !youtube?.oauth?.configured} className="admin-primary" onClick={() => action('/youtube/oauth/start', {})}>Kết nối / đổi tài khoản Google <ExternalLink size={16} /></button><button disabled={busy} onClick={() => action('/youtube/status', {})}><RefreshCw size={16} />Kiểm tra kênh & quyền</button><button disabled={busy || !youtube?.connected || running.length > 0} onClick={() => action('/jobs', { kind: 'youtube' })}>Đồng bộ các ngày đủ điều kiện</button></div>
      {youtube?.code === 'signup_required' && <div className="admin-guide"><h2>Hoàn tất thiết lập kênh</h2><ol><li>Mở YouTube bằng tài khoản Google đã cấp quyền và tạo hoặc chọn đúng kênh.</li><li>Quay lại đây, bấm kết nối lại Google để cấp quyền cho kênh.</li><li>Bấm kiểm tra kênh rồi đồng bộ lại video.</li></ol><a className="admin-text-link" href="https://www.youtube.com/create_channel" target="_blank" rel="noreferrer">Mở YouTube để thiết lập kênh <ExternalLink size={16} /></a></div>}
      {!youtube?.oauth?.configured && <div className="admin-guide"><h2>Thiết lập kết nối trên web</h2><p>Cần OAuth client loại Web application và domain HTTPS trước khi kết nối Google.</p><ol><li>Cấu hình <code>ADMIN_PUBLIC_URL</code> bằng domain HTTPS của website.</li><li>Đăng ký URL callback bên dưới trong Google Cloud.</li><li>Đặt credentials JSON của Web client tại thư mục riêng của worker trên server. Không tải token lên trình duyệt.</li></ol><label>URL callback<input readOnly value={youtube?.oauth?.callback_url || 'Chưa cấu hình domain HTTPS'} /></label></div>}<div className="admin-alert">Không cần copy link hoặc mã xác thực. Google sẽ chuyển bạn về CMS sau khi cấp quyền. Việc tạo kênh diễn ra trên YouTube.</div></div>}
      {section === 'settings' && <SettingsForm key={JSON.stringify(data.settings)} values={data.settings} action={action} busy={busy} />}
      {section === 'audit' && (!audit.length ? <Empty>Chưa có nhật ký quản trị.</Empty> : <div className="admin-table-scroll"><table><thead><tr><th>Thời gian</th><th>Thao tác</th><th>Chi tiết</th></tr></thead><tbody>{audit.map(row => <tr key={row.id}><td className="admin-nowrap">{formatTime(row.created_at)}</td><td>{({ login: 'Đăng nhập', logout: 'Đăng xuất', job_created: 'Tạo tác vụ', job_completed: 'Tác vụ hoàn thành', job_failed: 'Tác vụ thất bại', job_interrupted: 'Phục hồi tác vụ gián đoạn', cleanup_started: 'Bắt đầu dọn dữ liệu', cleanup_completed: 'Đã dọn dữ liệu', settings_updated: 'Đổi cấu hình', youtube_checked: 'Kiểm tra YouTube', youtube_connected: 'Kết nối Google' })[row.action] || row.action}</td><td><code className="admin-audit-detail">{JSON.stringify(row.detail)}</code></td></tr>)}</tbody></table></div>)}
      {!NAV.some(([key]) => key === section) && <Empty>Trang quản trị không tồn tại. Chọn mục trong thanh điều hướng.</Empty>}
      </>}
      <footer className="admin-footer">BP AOE · Vận hành theo giờ Việt Nam · Tự cập nhật mỗi 10 giây</footer>
    </main>
    {cleanup && <dialog ref={dialog} className="admin-dialog" onCancel={() => setCleanup(null)}><h2>Xác nhận xóa dữ liệu</h2><p>Sẽ xóa <strong>{cleanup.files.length} file</strong>, giải phóng <strong>{formatBytes(cleanup.bytes)}</strong>. Thao tác không thể hoàn tác.</p><div className="admin-preview-files">{cleanup.files.map(file => <div key={file.path}><code>{file.path}</code><span>{formatBytes(file.size)}</span></div>)}</div><p className="admin-muted">Bản xem trước có hiệu lực 10 phút. Nếu dữ liệu thay đổi, cần kiểm tra lại.</p><div className="admin-actions"><button disabled={busy} onClick={() => setCleanup(null)}>Hủy</button><button className="admin-danger-button" disabled={busy || !cleanup.files.length} onClick={async () => { const id = cleanup.id; setCleanup(null); await action('/cleanup/execute', { id, confirm: true }); }}>Xác nhận xóa {cleanup.files.length} file</button></div></dialog>}
  </div>;
}
