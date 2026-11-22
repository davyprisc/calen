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
    return { data: empty, error: 'Не удалось прочитать сохранённые данные. Записи в браузере защищены от перезаписи. Для восстановления можно импортировать резервную копию.' };
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
  const period = `${dateText(week)} – ${dateText(addDays(week, 6))}`;
  return <header className="toolbar">
    <div className="masthead flex flex-wrap items-center justify-between gap-3">
      <h1>Мои занятия</h1>
      <div className="flex flex-wrap gap-2"><button onClick={students}>Ученики</button><button onClick={settings}>Настройки</button><button className="primary" onClick={add}>＋ Добавить занятие</button></div>
    </div>
    <div className="controls flex flex-wrap items-center gap-2">
      <button onClick={() => setDate(today)}>Сегодня</button>
      <div className="pager flex gap-1"><button onClick={() => setDate(addDays(date, -7))} aria-label="Предыдущая неделя">‹</button><button onClick={() => setDate(addDays(date, 7))} aria-label="Следующая неделя">›</button></div>
      <strong className="period">{period}</strong>
      <input aria-label="Перейти к дате" type="date" min="1900-01-01" max="2100-12-31" value={date} onChange={e => { if (e.target.validity.valid && e.target.value) setDate(e.target.value); }} />
      <span className="grow control-spacer" />
      <input aria-label="Поиск по имени ученика" type="search" placeholder="Имя ученика" value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label="Фильтр по статусу" value={filter} onChange={e => setFilter(e.target.value)}><option value="">Все статусы</option>{statuses.map(status => <option key={status}>{status}</option>)}</select>
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
      if (confirm(`Заменить текущие данные? В копии учеников: ${next.students.length}, занятий: ${next.lessons.length}.`)) await replace(next);
    } catch (error) {
      report(error instanceof SyntaxError ? 'Файл содержит некорректный JSON.' : error instanceof Error ? error.message : 'Не удалось прочитать файл.');
    }
  }
  return <section className="backup" aria-labelledby="backup-title">
    <h3 id="backup-title">Резервная копия</h3>
    <p>{cloud ? 'Расписание хранится в Firebase. Для резервной копии используйте экспорт.' : 'Данные хранятся только в этом браузере. Для резервной копии используйте экспорт.'}</p>
    <div className="flex flex-wrap gap-2"><button onClick={download}>Экспорт JSON</button><button onClick={() => input.current?.click()}>Импорт JSON</button></div>
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
    if (storageError && !restore) return writeError('Импортируйте резервную копию, чтобы восстановить сохранение.');
    if (cloud) {
      writing.current = true;
      setSaving(true);
      try {
        const nextRevision = await cloud.save(next, revision.current);
        if (nextRevision === null) return writeError('Расписание уже изменилось на другом устройстве. Скопируйте введённые данные, закройте форму и нажмите «Обновить». Затем повторите изменение.');
        revision.current = nextRevision;
        setRefreshError(false);
      } catch (error) {
        return writeError(error instanceof Error && error.message === snapshotTooLarge ? snapshotTooLarge : 'Не удалось подтвердить сохранение в Firebase. Проверьте подключение и повторите попытку.');
      } finally {
        writing.current = false;
        setSaving(false);
      }
    } else {
      try { localStorage.setItem(key, JSON.stringify(next)); }
      catch { return writeError('Не удалось сохранить изменения. Предыдущие данные сохранены.'); }
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
        setNotice({ text: 'Расписание обновлено.', error: false });
      }
    } catch {
      setRefreshError(true);
    }
  }

  function create(day: string, start: number) {
    setEditor({ editing: false, lesson: { id: uid(), studentId: '', subject: '', date: day, start, end: Math.min(1439, start + settings.duration), status: statuses[0], paid: false, format: 'Онлайн', price: '', location: '', note: '' } });
  }

  async function writeLessons(next: Lesson[], removed: Lesson[], students: Data['students'], message: string) {
    if (next.some(item => item.start < 0 || item.end <= item.start || item.end > 1439 || item.date < '1900-01-01' || item.date > '2100-12-31')) {
      setNotice({ text: 'Изменение выходит за допустимые границы даты или времени.', error: true });
      return false;
    }
    const ids = new Set(removed.map(item => item.id));
    const remaining = data.lessons.filter(item => !ids.has(item.id));
    const conflicts = next.filter((item, index) => remaining.some(other => overlaps(item, other)) || next.some((other, i) => i !== index && overlaps(item, other)));
    if (conflicts.length && !confirm(`Пересечения в расписании. Затронуто занятий: ${conflicts.length}. Сохранить всё равно?`)) return false;
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
      choose('Какие занятия изменить?', future => {
        const items = affected(data.lessons, original, future);
        writeLessons(revise(items, original, next), items, students, 'Изменения сохранены.');
      }, original);
      return true;
    }
    const series = dates ? uid() : undefined;
    const lessons = dates ? dates.map(date => ({ ...next, id: uid(), series, date, occurrence: date })) : [next];
    return writeLessons(lessons, [], students, dates ? `Создано занятий: ${lessons.length}.` : 'Занятие добавлено.');
  }

  function removeLesson() {
    if (!editor) return;
    const original = editor.lesson;
    choose('Какие занятия удалить?', future => {
      const items = affected(data.lessons, original, future);
      if (confirm(`Удалить выбранные занятия? Количество: ${items.length}.`)) void writeLessons([], items, data.students, 'Удаление выполнено.');
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
    {cloud && <div className="calendar-meta flex flex-wrap items-center justify-end gap-2">
      {(saving || refreshError) && <span role="status">{saving ? 'Сохраняю в Firebase…' : 'Связь с Firebase прервана. Обновите расписание.'}</span>}
      <div className="flex gap-2">
        <button disabled={saving} onClick={refreshManually}>Обновить</button>
        <button disabled={saving} onClick={() => cloud.signOut().catch(() => writeError('Не удалось выйти из аккаунта.'))}>Выйти</button>
      </div>
    </div>}
    {storageError && <p className="error storage" role="alert">{storageError}</p>}
    <div className="calendar-meta flex flex-wrap items-center justify-between gap-2">
      <span>Неделя <span aria-hidden="true">·</span> {settings.zone} ({timezone})</span>
      {visible > 0 && <span>Занятий в расписании: {visible}</span>}
    </div>
    {!visible && <div className="empty-state flex flex-wrap items-center justify-between gap-2">
      <span>{data.lessons.length ? 'На выбранный период нет видимых занятий.' : 'Занятий пока нет. Нажмите «Добавить занятие», чтобы запланировать первое.'}</span>
      {!data.lessons.length && <button onClick={() => commit(sample(data, date), 'Пример загружен.')}>Загрузить пример</button>}
    </div>}
    <Calendar data={data} date={date} now={now} lessons={lessons} create={create} edit={lesson => setEditor({ lesson, editing: true })}
      move={(original, next, resize) => choose('Какие занятия изменить?', future => {
        const items = affected(data.lessons, original, future);
        writeLessons(revise(items, original, next), items, data.students, resize ? 'Длительность изменена.' : 'Занятие перенесено.');
      }, original)} />
    {editor && <LessonForm key={editor.lesson.id} initial={editor.lesson} editing={editor.editing} students={data.students} currency={settings.currency} close={() => setEditor(null)} save={saveLesson} remove={removeLesson} />}
    {panel === 'settings' && <SettingsForm settings={settings} close={() => setPanel(null)} save={async next => { if (await commit({ ...data, settings: next }, 'Настройки сохранены.')) setPanel(null); }}>
      <Backup data={data} cloud={Boolean(cloud)} replace={async next => { if (await commit(next, 'Резервная копия восстановлена.', true)) setDate(clock(next.settings.zone).date); }} report={text => { writeError(text); }} />
    </SettingsForm>}
    {panel === 'students' && <StudentsForm students={data.students} currency={settings.currency} close={() => setPanel(null)} save={student => {
      const existing = data.students.find(s => s.id === student.id);
      const students = existing ? data.students.map(s => s.id === student.id ? student : s) : [...data.students, student];
      return commit({ ...data, students }, existing?.archived !== student.archived && existing ? (student.archived ? 'Ученик в архиве.' : 'Ученик возвращён в список.') : 'Данные ученика сохранены.');
    }} />}
    {choice && <Modal title={choice.title} close={() => setChoice(null)}><div className="form">
      <button onClick={() => { setChoice(null); choice.action(false); }}>Только это занятие</button>
      <button onClick={() => { setChoice(null); choice.action(true); }}>Это и все последующие занятия серии</button>
      <button onClick={() => setChoice(null)}>Отмена</button>
    </div></Modal>}
    {notice && <div className={`toast ${notice.error ? 'error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.text}<button onClick={() => setNotice(null)} aria-label="Закрыть уведомление">×</button></div>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<CloudGate render={cloud => <App cloud={cloud} />} />);
