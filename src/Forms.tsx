import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { dateText, minutes, repeatDates, shortDays, statuses, time, uid, validPrice, validSettings, weekday, type Lesson, type Settings, type Student } from './model';

export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} onCancel={event => { event.preventDefault(); close(); }} aria-labelledby={id}>
    <header className="modal-title"><h2 id={id}>{title}</h2><button type="button" aria-label="Ð—Ð°ÐºÑ€Ñ‹Ñ‚ÑŒ" onClick={close}>Ã—</button></header>
    {children}
  </dialog>;
}

export function LessonForm({ initial, editing, students, currency, close, save, remove }: {
  initial: Lesson; editing: boolean; students: Student[]; currency: string; close: () => void;
  save: (lesson: Lesson, dates: string[] | null, name: string) => Promise<boolean>; remove: () => void;
}) {
  const [lesson, setLesson] = useState(initial);
  const [name, setName] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [selected, setSelected] = useState([weekday(initial.date)]);
  const [until, setUntil] = useState('');
  const [error, setError] = useState('');
  const update = (patch: Partial<Lesson>) => setLesson(current => ({ ...current, ...patch }));
  const dates = repeat ? repeatDates(lesson.date, until, selected) : null;
  const adding = lesson.studentId === 'new';
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!lesson.studentId || (adding && !name.trim()) || !lesson.subject.trim()) return setError('Ð£ÐºÐ°Ð¶Ð¸Ñ‚Ðµ ÑƒÑ‡ÐµÐ½Ð¸ÐºÐ° Ð¸ Ð¿Ñ€ÐµÐ´Ð¼ÐµÑ‚.');
    if (!(lesson.end > lesson.start)) return setError('Ð’Ñ€ÐµÐ¼Ñ Ð¾ÐºÐ¾Ð½Ñ‡Ð°Ð½Ð¸Ñ Ð´Ð¾Ð»Ð¶Ð½Ð¾ Ð±Ñ‹Ñ‚ÑŒ Ð¿Ð¾Ð·Ð¶Ðµ Ð½Ð°Ñ‡Ð°Ð»Ð°.');
    if (!validPrice(lesson.price)) return setError('Ð’Ð²ÐµÐ´Ð¸Ñ‚Ðµ ÑÑ‚Ð¾Ð¸Ð¼Ð¾ÑÑ‚ÑŒ Ñ Ñ‚Ð¾Ñ‡Ð½Ð¾ÑÑ‚ÑŒÑŽ Ð´Ð¾ Ð´Ð²ÑƒÑ… Ð·Ð½Ð°ÐºÐ¾Ð² Ð¿Ð¾ÑÐ»Ðµ Ð·Ð°Ð¿ÑÑ‚Ð¾Ð¹.');
    if (repeat && !dates?.length) return setError('Ð’Ñ‹Ð±ÐµÑ€Ð¸Ñ‚Ðµ Ð´Ð½Ð¸ Ð½ÐµÐ´ÐµÐ»Ð¸ Ð¸ Ð´Ð°Ñ‚Ñƒ Ð¾ÐºÐ¾Ð½Ñ‡Ð°Ð½Ð¸Ñ, Ñ‡Ñ‚Ð¾Ð±Ñ‹ Ð² Ð¿ÐµÑ€Ð¸Ð¾Ð´Ðµ Ð±Ñ‹Ð»Ð¾ Ñ…Ð¾Ñ‚Ñ Ð±Ñ‹ Ð¾Ð´Ð½Ð¾ Ð·Ð°Ð½ÑÑ‚Ð¸Ðµ.');
    save({ ...lesson, subject: lesson.subject.trim() }, dates, adding ? name.trim() : '');
  }
  return <Modal title={editing ? 'Ð—Ð°Ð½ÑÑ‚Ð¸Ðµ' : 'ÐÐ¾Ð²Ð¾Ðµ Ð·Ð°Ð½ÑÑ‚Ð¸Ðµ'} close={close}>
    <form className="form" onSubmit={submit}>
      <label>Ð£Ñ‡ÐµÐ½Ð¸Ðº<select required value={lesson.studentId} onChange={event => {
        const student = students.find(item => item.id === event.target.value);
        update({ studentId: event.target.value, ...(student ? { subject: student.subject, price: student.price } : {}) });
      }}><option value="">Ð’Ñ‹Ð±ÐµÑ€Ð¸Ñ‚Ðµ ÑƒÑ‡ÐµÐ½Ð¸ÐºÐ°</option>{students.filter(s => !s.archived || s.id === lesson.studentId).map(s => <option key={s.id} value={s.id}>{s.name}{s.archived ? ' (Ð°Ñ€Ñ…Ð¸Ð²)' : ''}</option>)}<option value="new">Ð”Ð¾Ð±Ð°Ð²Ð¸Ñ‚ÑŒ Ð½Ð¾Ð²Ð¾Ð³Ð¾ ÑƒÑ‡ÐµÐ½Ð¸ÐºÐ°</option></select></label>
      {adding && <label>Ð˜Ð¼Ñ Ð¸ Ñ„Ð°Ð¼Ð¸Ð»Ð¸Ñ<input required value={name} onChange={e => setName(e.target.value)} /></label>}
      <label>ÐŸÑ€ÐµÐ´Ð¼ÐµÑ‚ / Ð½Ð°Ð·Ð²Ð°Ð½Ð¸Ðµ<input required value={lesson.subject} onChange={e => update({ subject: e.target.value })} /></label>
      <div className="form-row">
        <label>Ð”Ð°Ñ‚Ð° Â· {dateText(lesson.date)}<input required type="date" min="1900-01-01" max="2100-12-31" value={lesson.date} onChange={e => {
          const date = e.target.value;
          if (date && !repeat) setSelected([weekday(date)]);
          update({ date });
        }} /></label>
        <label>ÐÐ°Ñ‡Ð°Ð»Ð¾<input required type="time" value={time(lesson.start)} onChange={e => {
          const start = minutes(e.target.value);
          update({ start, end: !editing && Number.isFinite(start) && Number.isFinite(lesson.start) ? Math.min(1439, start + lesson.end - lesson.start) : lesson.end });
        }} /></label>
        <label>ÐžÐºÐ¾Ð½Ñ‡Ð°Ð½Ð¸Ðµ<input required type="time" value={time(lesson.end)} onChange={e => update({ end: minutes(e.target.value) })} /></label>
      </div>
      <div className="form-row">
        <label>Ð¤Ð¾Ñ€Ð¼Ð°Ñ‚<select value={lesson.format} onChange={e => update({ format: e.target.value as Lesson['format'] })}><option>ÐžÐ½Ð»Ð°Ð¹Ð½</option><option>ÐžÑ‡Ð½Ð¾</option></select></label>
        <label>{lesson.format === 'ÐžÐ½Ð»Ð°Ð¹Ð½' ? 'Ð¡ÑÑ‹Ð»ÐºÐ° Ð½Ð° Ð²ÑÑ‚Ñ€ÐµÑ‡Ñƒ' : 'ÐÐ´Ñ€ÐµÑ'}<input value={lesson.location} onChange={e => update({ location: e.target.value })} /></label>
      </div>
      <div className="form-row">
        <label>Ð¡Ñ‚Ð¾Ð¸Ð¼Ð¾ÑÑ‚ÑŒ, {currency}<input type="number" min="0" step=".01" value={lesson.price} onChange={e => update({ price: e.target.value })} /></label>
        <label>Ð¡Ñ‚Ð°Ñ‚ÑƒÑ<select value={lesson.status} onChange={e => update({ status: e.target.value as Lesson['status'] })}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label>
        <label>ÐžÐ¿Ð»Ð°Ñ‚Ð°<select value={String(lesson.paid)} onChange={e => update({ paid: e.target.value === 'true' })}><option value="false">ÐÐµ Ð¾Ð¿Ð»Ð°Ñ‡ÐµÐ½Ð¾</option><option value="true">ÐžÐ¿Ð»Ð°Ñ‡ÐµÐ½Ð¾</option></select></label>
      </div>
      <label>Ð—Ð°Ð¼ÐµÑ‚ÐºÐ°<textarea rows={2} value={lesson.note} onChange={e => update({ note: e.target.value })} /></label>
      {!editing && <label className="check"><input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} /> ÐŸÐ¾Ð²Ñ‚Ð¾Ñ€ÑÑ‚ÑŒ ÐºÐ°Ð¶Ð´ÑƒÑŽ Ð½ÐµÐ´ÐµÐ»ÑŽ</label>}
      {repeat && <fieldset>
        <legend>Ð”Ð½Ð¸ Ð¿Ð¾Ð²Ñ‚Ð¾Ñ€ÐµÐ½Ð¸Ñ</legend>
        <div className="days-options">{shortDays.map((day, i) => <label className="check" key={day}><input type="checkbox" checked={selected.includes(i)} onChange={e => setSelected(e.target.checked ? [...selected, i] : selected.filter(d => d !== i))} />{day}</label>)}</div>
        <label>Ð”Ð°Ñ‚Ð° Ð¾ÐºÐ¾Ð½Ñ‡Ð°Ð½Ð¸Ñ Ð¿Ð¾Ð²Ñ‚Ð¾Ñ€ÐµÐ½Ð¸Ð¹<input required type="date" min={lesson.date} max="2100-12-31" value={until} onInput={e => setUntil(e.currentTarget.value)} /></label>
        <p role="status">Ð‘ÑƒÐ´ÐµÑ‚ ÑÐ¾Ð·Ð´Ð°Ð½Ð¾ Ð·Ð°Ð½ÑÑ‚Ð¸Ð¹: {dates?.length ?? 0}</p>
      </fieldset>}
      {error && <p role="alert" className="error">{error}</p>}
      <footer className="actions">{editing && <button type="button" className="danger" onClick={remove}>Ð£Ð´Ð°Ð»Ð¸Ñ‚ÑŒ</button>}<span className="grow" /><button type="button" onClick={close}>ÐžÑ‚Ð¼ÐµÐ½Ð°</button><button className="primary">Ð¡Ð¾Ñ…Ñ€Ð°Ð½Ð¸Ñ‚ÑŒ</button></footer>
    </form>
  </Modal>;
}

const newStudent = (): Student => ({ id: uid(), name: '', subject: '', price: '', contact: '', note: '', archived: false });

export function StudentsForm({ students, currency, close, save }: { students: Student[]; currency: string; close: () => void; save: (student: Student) => Promise<boolean> }) {
  const [student, setStudent] = useState<Student | null>(null);
  const [error, setError] = useState('');
  const fields = [['name', 'Ð˜Ð¼Ñ Ð¸ Ñ„Ð°Ð¼Ð¸Ð»Ð¸Ñ'], ['subject', 'ÐŸÑ€ÐµÐ´Ð¼ÐµÑ‚ Ð¿Ð¾ ÑƒÐ¼Ð¾Ð»Ñ‡Ð°Ð½Ð¸ÑŽ'], ['price', `Ð¡Ñ‚Ð¾Ð¸Ð¼Ð¾ÑÑ‚ÑŒ Ð¿Ð¾ ÑƒÐ¼Ð¾Ð»Ñ‡Ð°Ð½Ð¸ÑŽ, ${currency}`], ['contact', 'ÐšÐ¾Ð½Ñ‚Ð°ÐºÑ‚']];
  return <Modal title="Ð£Ñ‡ÐµÐ½Ð¸ÐºÐ¸" close={close}>
    {student ? <form className="form" onSubmit={async event => {
      event.preventDefault();
      if (!student.name.trim() || !validPrice(student.price)) return setError('ÐŸÑ€Ð¾Ð²ÐµÑ€ÑŒÑ‚Ðµ Ð¸Ð¼Ñ Ð¸ ÑÑ‚Ð¾Ð¸Ð¼Ð¾ÑÑ‚ÑŒ.');
      if (await save({ ...student, name: student.name.trim() })) setStudent(null);
    }}>
      {fields.map(([key, title]) => {
        const field = key as 'name' | 'subject' | 'price' | 'contact';
        return <label key={field}>{title}<input required={field === 'name'} type={field === 'price' ? 'number' : 'text'} min="0" step=".01" value={student[field]} onChange={e => setStudent({ ...student, [field]: e.target.value })} /></label>;
      })}
      <label>Ð—Ð°Ð¼ÐµÑ‚ÐºÐ°<textarea value={student.note} onChange={e => setStudent({ ...student, note: e.target.value })} /></label>
      {error && <p role="alert" className="error">{error}</p>}
      <footer className="actions"><button type="button" onClick={() => { setError(''); setStudent(null); }}>Ðš ÑÐ¿Ð¸ÑÐºÑƒ</button><button className="primary">Ð¡Ð¾Ñ…Ñ€Ð°Ð½Ð¸Ñ‚ÑŒ</button></footer>
    </form> : <div className="form">
      <button className="primary self-start" onClick={() => { setError(''); setStudent(newStudent()); }}>Ð”Ð¾Ð±Ð°Ð²Ð¸Ñ‚ÑŒ ÑƒÑ‡ÐµÐ½Ð¸ÐºÐ°</button>
      {!students.length && <p className="muted">Ð¡Ð¿Ð¸ÑÐ¾Ðº Ð¿Ð¾ÐºÐ° Ð¿ÑƒÑÑ‚.</p>}
      {[false, true].map(archived => {
        const list = students.filter(s => s.archived === archived);
        return list.length > 0 && <section key={String(archived)}><h3>{archived ? 'ÐÑ€Ñ…Ð¸Ð²' : 'ÐÐºÑ‚Ð¸Ð²Ð½Ñ‹Ðµ'}</h3>
          {list.map(s => <div className="student-row" key={s.id}><div className="grow"><strong>{s.name}</strong><p className="muted">{[s.subject, s.price && `${s.price} ${currency}`].filter(Boolean).join(' Â· ')}</p></div>
            <button onClick={() => { setError(''); setStudent(s); }}>Ð˜Ð·Ð¼ÐµÐ½Ð¸Ñ‚ÑŒ</button><button onClick={() => save({ ...s, archived: !s.archived })}>{archived ? 'Ð’ÐµÑ€Ð½ÑƒÑ‚ÑŒ' : 'Ð’ Ð°Ñ€Ñ…Ð¸Ð²'}</button></div>)}
        </section>;
      })}
    </div>}
  </Modal>;
}

export function SettingsForm({ settings, close, save, children }: { settings: Settings; children: ReactNode; close: () => void; save: (settings: Settings) => void }) {
  const [draft, setDraft] = useState(settings);
  const [error, setError] = useState('');
  return <Modal title="ÐÐ°ÑÑ‚Ñ€Ð¾Ð¹ÐºÐ¸" close={close}>
    <form className="form" onSubmit={event => {
      event.preventDefault();
      const next = { ...draft, currency: draft.currency.trim().toUpperCase(), zone: draft.zone.trim() };
      if (!validSettings(next)) return setError('ÐŸÑ€Ð¾Ð²ÐµÑ€ÑŒÑ‚Ðµ Ñ€Ð°Ð±Ð¾Ñ‡Ð¸Ðµ Ñ‡Ð°ÑÑ‹, Ð´Ð»Ð¸Ñ‚ÐµÐ»ÑŒÐ½Ð¾ÑÑ‚ÑŒ, Ñ‚Ñ€Ñ‘Ñ…Ð±ÑƒÐºÐ²ÐµÐ½Ð½Ñ‹Ð¹ ÐºÐ¾Ð´ Ð²Ð°Ð»ÑŽÑ‚Ñ‹ Ð¸ Ñ‡Ð°ÑÐ¾Ð²Ð¾Ð¹ Ð¿Ð¾ÑÑ.');
      save(next);
    }}>
      <div className="form-row">
        <label>ÐÐ°Ñ‡Ð°Ð»Ð¾ Ñ€Ð°Ð±Ð¾Ñ‡ÐµÐ³Ð¾ Ð´Ð½Ñ<input required type="time" value={time(draft.start)} onChange={e => setDraft({ ...draft, start: minutes(e.target.value) })} /></label>
        <label>ÐšÐ¾Ð½ÐµÑ† Ñ€Ð°Ð±Ð¾Ñ‡ÐµÐ³Ð¾ Ð´Ð½Ñ<input required type="time" value={time(draft.end)} onChange={e => setDraft({ ...draft, end: minutes(e.target.value) })} /></label>
      </div>
      <div className="form-row">
        <label>Ð”Ð»Ð¸Ñ‚ÐµÐ»ÑŒÐ½Ð¾ÑÑ‚ÑŒ, Ð¼Ð¸Ð½<input required type="number" min="1" max="1439" value={draft.duration || ''} onChange={e => setDraft({ ...draft, duration: Number(e.target.value) })} /></label>
        <label>Ð’Ð°Ð»ÑŽÑ‚Ð°<input required maxLength={3} value={draft.currency} onChange={e => setDraft({ ...draft, currency: e.target.value })} /></label>
      </div>
      <label>Ð§Ð°ÑÐ¾Ð²Ð¾Ð¹ Ð¿Ð¾ÑÑ<input required list="zones" value={draft.zone} onChange={e => setDraft({ ...draft, zone: e.target.value })} /></label>
      <datalist id="zones">{['Europe/Minsk', 'Europe/Moscow', 'Europe/Warsaw', 'Europe/Vilnius', 'UTC', ...Intl.supportedValuesOf('timeZone')].map((zone, i) => <option key={i} value={zone} />)}</datalist>
      <label className="check"><input type="checkbox" checked={draft.weekends} onChange={e => setDraft({ ...draft, weekends: e.target.checked })} />ÐŸÐ¾ÐºÐ°Ð·Ñ‹Ð²Ð°Ñ‚ÑŒ Ð²Ñ‹Ñ…Ð¾Ð´Ð½Ñ‹Ðµ</label>
      {error && <p role="alert" className="error">{error}</p>}
      <footer className="actions"><button type="button" onClick={close}>ÐžÑ‚Ð¼ÐµÐ½Ð°</button><button className="primary">Ð¡Ð¾Ñ…Ñ€Ð°Ð½Ð¸Ñ‚ÑŒ</button></footer>
    </form>
    {children}
  </Modal>;
}
