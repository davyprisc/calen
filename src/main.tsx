import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { Calendar } from './Calendar';
import { CloudGate, snapshotTooLarge, type CloudStorage } from './Cloud';
import { LessonForm, Modal, SettingsForm, StudentsForm } from './Forms';
import { addDays, affected, clock, dateText, empty, key, monday, overlaps, parseData, revise, sample, statuses, uid, type Data, type Lesson } from './model';
import './style.css';

function read() {
  try {
    const raw = localStorage.getItem(key);
    return { data: raw === null ? empty : parseData(raw), error: '' };
  } catch {
    return { data: empty, error: 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¿Ñ€Ð¾Ñ‡Ð¸Ñ‚Ð°Ñ‚ÑŒ ÑÐ¾Ñ…Ñ€Ð°Ð½Ñ‘Ð½Ð½Ñ‹Ðµ Ð´Ð°Ð½Ð½Ñ‹Ðµ. Ð—Ð°Ð¿Ð¸ÑÐ¸ Ð² Ð±Ñ€Ð°ÑƒÐ·ÐµÑ€Ðµ Ð·Ð°Ñ‰Ð¸Ñ‰ÐµÐ½Ñ‹ Ð¾Ñ‚ Ð¿ÐµÑ€ÐµÐ·Ð°Ð¿Ð¸ÑÐ¸. Ð”Ð»Ñ Ð²Ð¾ÑÑÑ‚Ð°Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ñ Ð¼Ð¾Ð¶Ð½Ð¾ Ð¸Ð¼Ð¿Ð¾Ñ€Ñ‚Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ Ñ€ÐµÐ·ÐµÑ€Ð²Ð½ÑƒÑŽ ÐºÐ¾Ð¿Ð¸ÑŽ.' };
  }
}
type RangeChoice = { title: string; action: (future: boolean) => void };
type Editor = { lesson: Lesson; editing: boolean };

function Toolbar({ date, today, search, filter, setDate, setSearch, setFilter, add, students, settings }: {
  date: string; today: string; search: string; filter: string;
  setDate: (date: string) => void; setSearch: (value: string) => void; setFilter: (value: string) => void;
  add: () => void; students: () => void; settings: () => void;
}) {
  const week = monday(date);
  const period = `${dateText(week)} â€“ ${dateText(addDays(week, 6))}`;
  return <header className="toolbar">
    <div className="masthead flex flex-wrap items-center justify-between gap-3">
      <h1>ÐœÐ¾Ð¸ Ð·Ð°Ð½ÑÑ‚Ð¸Ñ</h1>
      <div className="flex flex-wrap gap-2"><button onClick={students}>Ð£Ñ‡ÐµÐ½Ð¸ÐºÐ¸</button><button onClick={settings}>ÐÐ°ÑÑ‚Ñ€Ð¾Ð¹ÐºÐ¸</button><button className="primary" onClick={add}>ï¼‹ Ð”Ð¾Ð±Ð°Ð²Ð¸Ñ‚ÑŒ Ð·Ð°Ð½ÑÑ‚Ð¸Ðµ</button></div>
    </div>
    <div className="controls flex flex-wrap items-center gap-2">
      <button onClick={() => setDate(today)}>Ð¡ÐµÐ³Ð¾Ð´Ð½Ñ</button>
      <div className="pager flex gap-1"><button onClick={() => setDate(addDays(date, -7))} aria-label="ÐŸÑ€ÐµÐ´Ñ‹Ð´ÑƒÑ‰Ð°Ñ Ð½ÐµÐ´ÐµÐ»Ñ">â€¹</button><button onClick={() => setDate(addDays(date, 7))} aria-label="Ð¡Ð»ÐµÐ´ÑƒÑŽÑ‰Ð°Ñ Ð½ÐµÐ´ÐµÐ»Ñ">â€º</button></div>
      <strong className="period">{period}</strong>
      <input aria-label="ÐŸÐµÑ€ÐµÐ¹Ñ‚Ð¸ Ðº Ð´Ð°Ñ‚Ðµ" type="date" min="1900-01-01" max="2100-12-31" value={date} onChange={e => { if (e.target.validity.valid && e.target.value) setDate(e.target.value); }} />
      <span className="grow control-spacer" />
      <input aria-label="ÐŸÐ¾Ð¸ÑÐº Ð¿Ð¾ Ð¸Ð¼ÐµÐ½Ð¸ ÑƒÑ‡ÐµÐ½Ð¸ÐºÐ°" type="search" placeholder="Ð˜Ð¼Ñ ÑƒÑ‡ÐµÐ½Ð¸ÐºÐ°" value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label="Ð¤Ð¸Ð»ÑŒÑ‚Ñ€ Ð¿Ð¾ ÑÑ‚Ð°Ñ‚ÑƒÑÑƒ" value={filter} onChange={e => setFilter(e.target.value)}><option value="">Ð’ÑÐµ ÑÑ‚Ð°Ñ‚ÑƒÑÑ‹</option>{statuses.map(status => <option key={status}>{status}</option>)}</select>
    </div>
  </header>;
}

function Backup({ data, cloud, replace, report }: { data: Data; cloud: boolean; replace: (data: Data) => Promise<void>; report: (text: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  function download() {
    const href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = `calen-${clock(data.settings.zone).date}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  async function load(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const next = parseData(await file.text());
      if (confirm(`Ð—Ð°Ð¼ÐµÐ½Ð¸Ñ‚ÑŒ Ñ‚ÐµÐºÑƒÑ‰Ð¸Ðµ Ð´Ð°Ð½Ð½Ñ‹Ðµ? Ð’ ÐºÐ¾Ð¿Ð¸Ð¸ ÑƒÑ‡ÐµÐ½Ð¸ÐºÐ¾Ð²: ${next.students.length}, Ð·Ð°Ð½ÑÑ‚Ð¸Ð¹: ${next.lessons.length}.`)) await replace(next);
    } catch (error) {
      report(error instanceof SyntaxError ? 'Ð¤Ð°Ð¹Ð» ÑÐ¾Ð´ÐµÑ€Ð¶Ð¸Ñ‚ Ð½ÐµÐºÐ¾Ñ€Ñ€ÐµÐºÑ‚Ð½Ñ‹Ð¹ JSON.' : error instanceof Error ? error.message : 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¿Ñ€Ð¾Ñ‡Ð¸Ñ‚Ð°Ñ‚ÑŒ Ñ„Ð°Ð¹Ð».');
    }
  }
  return <section className="backup" aria-labelledby="backup-title">
    <h3 id="backup-title">Ð ÐµÐ·ÐµÑ€Ð²Ð½Ð°Ñ ÐºÐ¾Ð¿Ð¸Ñ</h3>
    <p>{cloud ? 'Ð Ð°ÑÐ¿Ð¸ÑÐ°Ð½Ð¸Ðµ Ñ…Ñ€Ð°Ð½Ð¸Ñ‚ÑÑ Ð² Firebase. Ð”Ð»Ñ Ñ€ÐµÐ·ÐµÑ€Ð²Ð½Ð¾Ð¹ ÐºÐ¾Ð¿Ð¸Ð¸ Ð¸ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐ¹Ñ‚Ðµ ÑÐºÑÐ¿Ð¾Ñ€Ñ‚.' : 'Ð”Ð°Ð½Ð½Ñ‹Ðµ Ñ…Ñ€Ð°Ð½ÑÑ‚ÑÑ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð² ÑÑ‚Ð¾Ð¼ Ð±Ñ€Ð°ÑƒÐ·ÐµÑ€Ðµ. Ð”Ð»Ñ Ñ€ÐµÐ·ÐµÑ€Ð²Ð½Ð¾Ð¹ ÐºÐ¾Ð¿Ð¸Ð¸ Ð¸ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐ¹Ñ‚Ðµ ÑÐºÑÐ¿Ð¾Ñ€Ñ‚.'}</p>
    <div className="flex flex-wrap gap-2"><button onClick={download}>Ð­ÐºÑÐ¿Ð¾Ñ€Ñ‚ JSON</button><button onClick={() => input.current?.click()}>Ð˜Ð¼Ð¿Ð¾Ñ€Ñ‚ JSON</button></div>
    <input ref={input} type="file" accept=".json,application/json" hidden onChange={load} />
  </section>;
}

function App({ cloud }: { cloud?: CloudStorage }) {
  const [loaded] = useState(() => cloud ? { data: cloud.initial.data, error: '' } : read());
  const revision = useRef(cloud?.initial.revision ?? 0);
  const writing = useRef(false);
  const [saving, setSaving] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [data, setData] = useState(loaded.data);
  const [storageError, setStorageError] = useState(loaded.error);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [now, setNow] = useState(() => clock(data.settings.zone));
  const [date, setDate] = useState(now.date);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [panel, setPanel] = useState<'students' | 'settings' | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [choice, setChoice] = useState<RangeChoice | null>(null);
  const { settings } = data;
  useEffect(() => {
    const tick = () => setNow(clock(settings.zone));
    tick();
    const timer = setInterval(tick, 15000);
    return () => clearInterval(timer);
  }, [settings.zone]);
  useEffect(() => {
    if (!notice || notice.error) return;
    const id = setTimeout(() => setNotice(null), 4200);
    return () => clearTimeout(id);
  }, [notice]);

  const dialogOpen = Boolean(editor || panel || choice);
  useEffect(() => {
    if (!cloud || dialogOpen) return;
    const storage = cloud;
    let active = true;
    let reading = false;
    async function refresh() {
      if (reading || writing.current || document.hidden) return;
      reading = true;
      const previous = revision.current;
      try {
        const result = await storage.load();
        if (!active || writing.current || revision.current !== previous) return;
        if (result.revision > previous) {
          revision.current = result.revision;
          setData(result.data);
        }
        setRefreshError(false);
      } catch {
        if (active) setRefreshError(true);
      } finally {
        reading = false;
      }
    }
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const interval = setInterval(refresh, 15000);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [cloud, dialogOpen]);

  function writeError(text: string) {
    setNotice({ text, error: true });
    if (dialogOpen) alert(text);
    return false;
  }

  async function commit(next: Data, text: string, restore = false) {
    if (writing.current) return false;
    if (storageError && !restore) return writeError('Ð˜Ð¼Ð¿Ð¾Ñ€Ñ‚Ð¸Ñ€ÑƒÐ¹Ñ‚Ðµ Ñ€ÐµÐ·ÐµÑ€Ð²Ð½ÑƒÑŽ ÐºÐ¾Ð¿Ð¸ÑŽ, Ñ‡Ñ‚Ð¾Ð±Ñ‹ Ð²Ð¾ÑÑÑ‚Ð°Ð½Ð¾Ð²Ð¸Ñ‚ÑŒ ÑÐ¾Ñ…Ñ€Ð°Ð½ÐµÐ½Ð¸Ðµ.');
    if (cloud) {
      writing.current = true;
      setSaving(true);
      try {
        const nextRevision = await cloud.save(next, revision.current);
        if (nextRevision === null) return writeError('Ð Ð°ÑÐ¿Ð¸ÑÐ°Ð½Ð¸Ðµ ÑƒÐ¶Ðµ Ð¸Ð·Ð¼ÐµÐ½Ð¸Ð»Ð¾ÑÑŒ Ð½Ð° Ð´Ñ€ÑƒÐ³Ð¾Ð¼ ÑƒÑÑ‚Ñ€Ð¾Ð¹ÑÑ‚Ð²Ðµ. Ð¡ÐºÐ¾Ð¿Ð¸Ñ€ÑƒÐ¹Ñ‚Ðµ Ð²Ð²ÐµÐ´Ñ‘Ð½Ð½Ñ‹Ðµ Ð´Ð°Ð½Ð½Ñ‹Ðµ, Ð·Ð°ÐºÑ€Ð¾Ð¹Ñ‚Ðµ Ñ„Ð¾Ñ€Ð¼Ñƒ Ð¸ Ð½Ð°Ð¶Ð¼Ð¸Ñ‚Ðµ Â«ÐžÐ±Ð½Ð¾Ð²Ð¸Ñ‚ÑŒÂ». Ð—Ð°Ñ‚ÐµÐ¼ Ð¿Ð¾Ð²Ñ‚Ð¾Ñ€Ð¸Ñ‚Ðµ Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ðµ.');
        revision.current = nextRevision;
        setRefreshError(false);
      } catch (error) {
        return writeError(error instanceof Error && error.message === snapshotTooLarge ? snapshotTooLarge : 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¿Ð¾Ð´Ñ‚Ð²ÐµÑ€Ð´Ð¸Ñ‚ÑŒ ÑÐ¾Ñ…Ñ€Ð°Ð½ÐµÐ½Ð¸Ðµ Ð² Firebase. ÐŸÑ€Ð¾Ð²ÐµÑ€ÑŒÑ‚Ðµ Ð¿Ð¾Ð´ÐºÐ»ÑŽÑ‡ÐµÐ½Ð¸Ðµ Ð¸ Ð¿Ð¾Ð²Ñ‚Ð¾Ñ€Ð¸Ñ‚Ðµ Ð¿Ð¾Ð¿Ñ‹Ñ‚ÐºÑƒ.');
      } finally {
        writing.current = false;
        setSaving(false);
      }
    } else {
      try { localStorage.setItem(key, JSON.stringify(next)); }
      catch { return writeError('ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ ÑÐ¾Ñ…Ñ€Ð°Ð½Ð¸Ñ‚ÑŒ Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ñ. ÐŸÑ€ÐµÐ´Ñ‹Ð´ÑƒÑ‰Ð¸Ðµ Ð´Ð°Ð½Ð½Ñ‹Ðµ ÑÐ¾Ñ…Ñ€Ð°Ð½ÐµÐ½Ñ‹.'); }
    }
    setData(next);
    setStorageError('');
    setNotice({ text, error: false });
    return true;
  }

  async function refreshManually() {
    if (!cloud || writing.current) return;
    const previous = revision.current;
    try {
      const result = await cloud.load();
      if (!writing.current && revision.current === previous) {
        revision.current = result.revision;
        setData(result.data);
        setRefreshError(false);
        setNotice({ text: 'Ð Ð°ÑÐ¿Ð¸ÑÐ°Ð½Ð¸Ðµ Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¾.', error: false });
      }
    } catch {
      setRefreshError(true);
    }
  }

  function create(day: string, start: number) {
    setEditor({ editing: false, lesson: { id: uid(), studentId: '', subject: '', date: day, start, end: Math.min(1439, start + settings.duration), status: statuses[0], paid: false, format: 'ÐžÐ½Ð»Ð°Ð¹Ð½', price: '', location: '', note: '' } });
  }

  async function writeLessons(next: Lesson[], removed: Lesson[], students: Data['students'], message: string) {
    if (next.some(item => item.start < 0 || item.end <= item.start || item.end > 1439 || item.date < '1900-01-01' || item.date > '2100-12-31')) {
      setNotice({ text: 'Ð˜Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ðµ Ð²Ñ‹Ñ…Ð¾Ð´Ð¸Ñ‚ Ð·Ð° Ð´Ð¾Ð¿ÑƒÑÑ‚Ð¸Ð¼Ñ‹Ðµ Ð³Ñ€Ð°Ð½Ð¸Ñ†Ñ‹ Ð´Ð°Ñ‚Ñ‹ Ð¸Ð»Ð¸ Ð²Ñ€ÐµÐ¼ÐµÐ½Ð¸.', error: true });
      return false;
    }
    const ids = new Set(removed.map(item => item.id));
    const remaining = data.lessons.filter(item => !ids.has(item.id));
    const conflicts = next.filter((item, index) => remaining.some(other => overlaps(item, other)) || next.some((other, i) => i !== index && overlaps(item, other)));
    if (conflicts.length && !confirm(`ÐŸÐµÑ€ÐµÑÐµÑ‡ÐµÐ½Ð¸Ñ Ð² Ñ€Ð°ÑÐ¿Ð¸ÑÐ°Ð½Ð¸Ð¸. Ð—Ð°Ñ‚Ñ€Ð¾Ð½ÑƒÑ‚Ð¾ Ð·Ð°Ð½ÑÑ‚Ð¸Ð¹: ${conflicts.length}. Ð¡Ð¾Ñ…Ñ€Ð°Ð½Ð¸Ñ‚ÑŒ Ð²ÑÑ‘ Ñ€Ð°Ð²Ð½Ð¾?`)) return false;
    if (!(await commit({ ...data, students, lessons: [...remaining, ...next] }, message))) return false;
    if (next.length) setDate(next.reduce((first, item) => item.date < first ? item.date : first, next[0].date));
    setEditor(null);
    return true;
  }

  function choose(title: string, action: (future: boolean) => void, lesson: Lesson) {
    if (lesson.series) setChoice({ title, action });
    else action(false);
  }

  async function saveLesson(lesson: Lesson, dates: string[] | null, name: string) {
    if (!editor) return false;
    const student = name ? { id: uid(), name, subject: lesson.subject, price: lesson.price, contact: '', note: '', archived: false } : null;
    const students = student ? [...data.students, student] : data.students;
    const next = student ? { ...lesson, studentId: student.id } : lesson;
    if (editor.editing) {
      const original = editor.lesson;
      choose('ÐšÐ°ÐºÐ¸Ðµ Ð·Ð°Ð½ÑÑ‚Ð¸Ñ Ð¸Ð·Ð¼ÐµÐ½Ð¸Ñ‚ÑŒ?', future => {
        const items = affected(data.lessons, original, future);
        writeLessons(revise(items, original, next), items, students, 'Ð˜Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ñ ÑÐ¾Ñ…Ñ€Ð°Ð½ÐµÐ½Ñ‹.');
      }, original);
      return true;
    }
    const series = dates ? uid() : undefined;
    const lessons = dates ? dates.map(date => ({ ...next, id: uid(), series, date, occurrence: date })) : [next];
    return writeLessons(lessons, [], students, dates ? `Ð¡Ð¾Ð·Ð´Ð°Ð½Ð¾ Ð·Ð°Ð½ÑÑ‚Ð¸Ð¹: ${lessons.length}.` : 'Ð—Ð°Ð½ÑÑ‚Ð¸Ðµ Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ð¾.');
  }

  function removeLesson() {
    if (!editor) return;
    const original = editor.lesson;
    choose('ÐšÐ°ÐºÐ¸Ðµ Ð·Ð°Ð½ÑÑ‚Ð¸Ñ ÑƒÐ´Ð°Ð»Ð¸Ñ‚ÑŒ?', future => {
      const items = affected(data.lessons, original, future);
      if (confirm(`Ð£Ð´Ð°Ð»Ð¸Ñ‚ÑŒ Ð²Ñ‹Ð±Ñ€Ð°Ð½Ð½Ñ‹Ðµ Ð·Ð°Ð½ÑÑ‚Ð¸Ñ? ÐšÐ¾Ð»Ð¸Ñ‡ÐµÑÑ‚Ð²Ð¾: ${items.length}.`)) void writeLessons([], items, data.students, 'Ð£Ð´Ð°Ð»ÐµÐ½Ð¸Ðµ Ð²Ñ‹Ð¿Ð¾Ð»Ð½ÐµÐ½Ð¾.');
    }, original);
  }

  const studentsById = new Map(data.students.map(s => [s.id, s]));
  const term = search.trim().toLocaleLowerCase('ru');
  const lessons = data.lessons.filter(lesson => (!filter || filter === lesson.status) && (studentsById.get(lesson.studentId)?.name.toLocaleLowerCase('ru').includes(term)));
  const first = monday(date);
  const last = addDays(first, settings.weekends ? 6 : 4);
  const visible = lessons.filter(lesson => lesson.date >= first && lesson.date <= last && lesson.end > settings.start && lesson.start < settings.end).length;
  const timezone = new Intl.DateTimeFormat('ru', { timeZone: settings.zone, timeZoneName: 'shortOffset' }).formatToParts().find(part => part.type === 'timeZoneName')?.value;
  return <main className="app">
    <Toolbar date={date} today={now.date} search={search} filter={filter} setDate={d => { if (d >= '1900-01-01' && d <= '2100-12-31') setDate(d); }} setSearch={setSearch} setFilter={setFilter}
      add={() => create(date, settings.start)} students={() => setPanel('students')} settings={() => setPanel('settings')} />
    {cloud && <div className="calendar-meta flex flex-wrap items-center justify-between gap-2">
      <span role="status">{saving ? 'Ð¡Ð¾Ñ…Ñ€Ð°Ð½ÑÑŽ Ð² Firebaseâ€¦' : refreshError ? 'Ð¡Ð²ÑÐ·ÑŒ Ñ Firebase Ð¿Ñ€ÐµÑ€Ð²Ð°Ð½Ð°. ÐžÐ±Ð½Ð¾Ð²Ð¸Ñ‚Ðµ Ñ€Ð°ÑÐ¿Ð¸ÑÐ°Ð½Ð¸Ðµ.' : 'Ð Ð°ÑÐ¿Ð¸ÑÐ°Ð½Ð¸Ðµ ÑÐ¸Ð½Ñ…Ñ€Ð¾Ð½Ð¸Ð·Ð¸Ñ€ÑƒÐµÑ‚ÑÑ Ñ‡ÐµÑ€ÐµÐ· Firebase'}</span>
      <div className="flex gap-2">
        <button disabled={saving} onClick={refreshManually}>ÐžÐ±Ð½Ð¾Ð²Ð¸Ñ‚ÑŒ</button>
        <button disabled={saving} onClick={() => cloud.signOut().catch(() => writeError('ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð²Ñ‹Ð¹Ñ‚Ð¸ Ð¸Ð· Ð°ÐºÐºÐ°ÑƒÐ½Ñ‚Ð°.'))}>Ð’Ñ‹Ð¹Ñ‚Ð¸</button>
      </div>
    </div>}
    {storageError && <p className="error storage" role="alert">{storageError}</p>}
    <div className="calendar-meta flex flex-wrap items-center justify-between gap-2">
      <span>ÐÐµÐ´ÐµÐ»Ñ <span aria-hidden="true">Â·</span> {settings.zone} ({timezone})</span>
      {visible > 0 && <span>Ð—Ð°Ð½ÑÑ‚Ð¸Ð¹ Ð² Ñ€Ð°ÑÐ¿Ð¸ÑÐ°Ð½Ð¸Ð¸: {visible}</span>}
    </div>
    {!visible && <div className="empty-state flex flex-wrap items-center justify-between gap-2">
      <span>{data.lessons.length ? 'ÐÐ° Ð²Ñ‹Ð±Ñ€Ð°Ð½Ð½Ñ‹Ð¹ Ð¿ÐµÑ€Ð¸Ð¾Ð´ Ð½ÐµÑ‚ Ð²Ð¸Ð´Ð¸Ð¼Ñ‹Ñ… Ð·Ð°Ð½ÑÑ‚Ð¸Ð¹.' : 'Ð—Ð°Ð½ÑÑ‚Ð¸Ð¹ Ð¿Ð¾ÐºÐ° Ð½ÐµÑ‚. ÐÐ°Ð¶Ð¼Ð¸Ñ‚Ðµ Â«Ð”Ð¾Ð±Ð°Ð²Ð¸Ñ‚ÑŒ Ð·Ð°Ð½ÑÑ‚Ð¸ÐµÂ», Ñ‡Ñ‚Ð¾Ð±Ñ‹ Ð·Ð°Ð¿Ð»Ð°Ð½Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ Ð¿ÐµÑ€Ð²Ð¾Ðµ.'}</span>
      {!data.lessons.length && <button onClick={() => commit(sample(data, date), 'ÐŸÑ€Ð¸Ð¼ÐµÑ€ Ð·Ð°Ð³Ñ€ÑƒÐ¶ÐµÐ½.')}>Ð—Ð°Ð³Ñ€ÑƒÐ·Ð¸Ñ‚ÑŒ Ð¿Ñ€Ð¸Ð¼ÐµÑ€</button>}
    </div>}
    <Calendar data={data} date={date} now={now} lessons={lessons} create={create} edit={lesson => setEditor({ lesson, editing: true })}
      move={(original, next, resize) => choose('ÐšÐ°ÐºÐ¸Ðµ Ð·Ð°Ð½ÑÑ‚Ð¸Ñ Ð¸Ð·Ð¼ÐµÐ½Ð¸Ñ‚ÑŒ?', future => {
        const items = affected(data.lessons, original, future);
        writeLessons(revise(items, original, next), items, data.students, resize ? 'Ð”Ð»Ð¸Ñ‚ÐµÐ»ÑŒÐ½Ð¾ÑÑ‚ÑŒ Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð°.' : 'Ð—Ð°Ð½ÑÑ‚Ð¸Ðµ Ð¿ÐµÑ€ÐµÐ½ÐµÑÐµÐ½Ð¾.');
      }, original)} />
    {editor && <LessonForm key={editor.lesson.id} initial={editor.lesson} editing={editor.editing} students={data.students} currency={settings.currency} close={() => setEditor(null)} save={saveLesson} remove={removeLesson} />}
    {panel === 'settings' && <SettingsForm settings={settings} close={() => setPanel(null)} save={async next => { if (await commit({ ...data, settings: next }, 'ÐÐ°ÑÑ‚Ñ€Ð¾Ð¹ÐºÐ¸ ÑÐ¾Ñ…Ñ€Ð°Ð½ÐµÐ½Ñ‹.')) setPanel(null); }}>
      <Backup data={data} cloud={Boolean(cloud)} replace={async next => { if (await commit(next, 'Ð ÐµÐ·ÐµÑ€Ð²Ð½Ð°Ñ ÐºÐ¾Ð¿Ð¸Ñ Ð²Ð¾ÑÑÑ‚Ð°Ð½Ð¾Ð²Ð»ÐµÐ½Ð°.', true)) setDate(clock(next.settings.zone).date); }} report={text => { writeError(text); }} />
    </SettingsForm>}
    {panel === 'students' && <StudentsForm students={data.students} currency={settings.currency} close={() => setPanel(null)} save={student => {
      const existing = data.students.find(s => s.id === student.id);
      const students = existing ? data.students.map(s => s.id === student.id ? student : s) : [...data.students, student];
      return commit({ ...data, students }, existing?.archived !== student.archived && existing ? (student.archived ? 'Ð£Ñ‡ÐµÐ½Ð¸Ðº Ð² Ð°Ñ€Ñ…Ð¸Ð²Ðµ.' : 'Ð£Ñ‡ÐµÐ½Ð¸Ðº Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‰Ñ‘Ð½ Ð² ÑÐ¿Ð¸ÑÐ¾Ðº.') : 'Ð”Ð°Ð½Ð½Ñ‹Ðµ ÑƒÑ‡ÐµÐ½Ð¸ÐºÐ° ÑÐ¾Ñ…Ñ€Ð°Ð½ÐµÐ½Ñ‹.');
    }} />}
    {choice && <Modal title={choice.title} close={() => setChoice(null)}><div className="form">
      <button onClick={() => { setChoice(null); choice.action(false); }}>Ð¢Ð¾Ð»ÑŒÐºÐ¾ ÑÑ‚Ð¾ Ð·Ð°Ð½ÑÑ‚Ð¸Ðµ</button>
      <button onClick={() => { setChoice(null); choice.action(true); }}>Ð­Ñ‚Ð¾ Ð¸ Ð²ÑÐµ Ð¿Ð¾ÑÐ»ÐµÐ´ÑƒÑŽÑ‰Ð¸Ðµ Ð·Ð°Ð½ÑÑ‚Ð¸Ñ ÑÐµÑ€Ð¸Ð¸</button>
      <button onClick={() => setChoice(null)}>ÐžÑ‚Ð¼ÐµÐ½Ð°</button>
    </div></Modal>}
    {notice && <div className={`toast ${notice.error ? 'error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.text}<button onClick={() => setNotice(null)} aria-label="Ð—Ð°ÐºÑ€Ñ‹Ñ‚ÑŒ ÑƒÐ²ÐµÐ´Ð¾Ð¼Ð»ÐµÐ½Ð¸Ðµ">Ã—</button></div>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<CloudGate render={cloud => <App cloud={cloud} />} />);
