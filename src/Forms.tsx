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
    <header className="modal-title"><h2 id={id}>{title}</h2><button type="button" aria-label="Закрыть" onClick={close}>×</button></header>
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
    if (!lesson.studentId || (adding && !name.trim()) || !lesson.subject.trim()) return setError('Укажите ученика и предмет.');
    if (!(lesson.end > lesson.start)) return setError('Время окончания должно быть позже начала.');
    if (!validPrice(lesson.price)) return setError('Введите стоимость с точностью до двух знаков после запятой.');
    if (repeat && !dates?.length) return setError('Выберите дни недели и дату окончания, чтобы в периоде было хотя бы одно занятие.');
    save({ ...lesson, subject: lesson.subject.trim() }, dates, adding ? name.trim() : '');
  }
  return <Modal title={editing ? 'Занятие' : 'Новое занятие'} close={close}>
    <form className="form" onSubmit={submit}>
      <label>Ученик<select required value={lesson.studentId} onChange={event => {
        const student = students.find(item => item.id === event.target.value);
        update({ studentId: event.target.value, ...(student ? { subject: student.subject, price: student.price } : {}) });
      }}><option value="">Выберите ученика</option>{students.filter(s => !s.archived || s.id === lesson.studentId).map(s => <option key={s.id} value={s.id}>{s.name}{s.archived ? ' (архив)' : ''}</option>)}<option value="new">Добавить нового ученика</option></select></label>
      {adding && <label>Имя и фамилия<input required value={name} onChange={e => setName(e.target.value)} /></label>}
      <label>Предмет / название<input required value={lesson.subject} onChange={e => update({ subject: e.target.value })} /></label>
      <div className="form-row">
        <label>Дата · {dateText(lesson.date)}<input required type="date" min="1900-01-01" max="2100-12-31" value={lesson.date} onChange={e => {
          const date = e.target.value;
          if (date && !repeat) setSelected([weekday(date)]);
          update({ date });
        }} /></label>
        <label>Начало<input required type="time" value={time(lesson.start)} onChange={e => {
          const start = minutes(e.target.value);
          update({ start, end: !editing && Number.isFinite(start) && Number.isFinite(lesson.start) ? Math.min(1439, start + lesson.end - lesson.start) : lesson.end });
        }} /></label>
        <label>Окончание<input required type="time" value={time(lesson.end)} onChange={e => update({ end: minutes(e.target.value) })} /></label>
      </div>
      <div className="form-row">
        <label>Формат<select value={lesson.format} onChange={e => update({ format: e.target.value as Lesson['format'] })}><option>Онлайн</option><option>Очно</option></select></label>
        <label>{lesson.format === 'Онлайн' ? 'Ссылка на встречу' : 'Адрес'}<input value={lesson.location} onChange={e => update({ location: e.target.value })} /></label>
      </div>
      <div className="form-row">
        <label>Стоимость, {currency}<input type="number" min="0" step=".01" value={lesson.price} onChange={e => update({ price: e.target.value })} /></label>
        <label>Статус<select value={lesson.status} onChange={e => update({ status: e.target.value as Lesson['status'] })}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Оплата<select value={String(lesson.paid)} onChange={e => update({ paid: e.target.value === 'true' })}><option value="false">Не оплачено</option><option value="true">Оплачено</option></select></label>
      </div>
      <label>Заметка<textarea rows={2} value={lesson.note} onChange={e => update({ note: e.target.value })} /></label>
      {!editing && <label className="check"><input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} /> Повторять каждую неделю</label>}
      {repeat && <fieldset>
        <legend>Дни повторения</legend>
        <div className="days-options">{shortDays.map((day, i) => <label className="check" key={day}><input type="checkbox" checked={selected.includes(i)} onChange={e => setSelected(e.target.checked ? [...selected, i] : selected.filter(d => d !== i))} />{day}</label>)}</div>
        <label>Дата окончания повторений<input required type="date" min={lesson.date} max="2100-12-31" value={until} onInput={e => setUntil(e.currentTarget.value)} /></label>
        <p role="status">Будет создано занятий: {dates?.length ?? 0}</p>
      </fieldset>}
      {error && <p role="alert" className="error">{error}</p>}
      <footer className="actions">{editing && <button type="button" className="danger" onClick={remove}>Удалить</button>}<span className="grow" /><button type="button" onClick={close}>Отмена</button><button className="primary">Сохранить</button></footer>
    </form>
  </Modal>;
}

const newStudent = (): Student => ({ id: uid(), name: '', subject: '', price: '', contact: '', note: '', archived: false });

export function StudentsForm({ students, currency, close, save }: { students: Student[]; currency: string; close: () => void; save: (student: Student) => Promise<boolean> }) {
  const [student, setStudent] = useState<Student | null>(null);
  const [error, setError] = useState('');
  const fields = [['name', 'Имя и фамилия'], ['subject', 'Предмет по умолчанию'], ['price', `Стоимость по умолчанию, ${currency}`], ['contact', 'Контакт']];
  return <Modal title="Ученики" close={close}>
    {student ? <form className="form" onSubmit={async event => {
      event.preventDefault();
      if (!student.name.trim() || !validPrice(student.price)) return setError('Проверьте имя и стоимость.');
      if (await save({ ...student, name: student.name.trim() })) setStudent(null);
    }}>
      {fields.map(([key, title]) => {
        const field = key as 'name' | 'subject' | 'price' | 'contact';
        return <label key={field}>{title}<input required={field === 'name'} type={field === 'price' ? 'number' : 'text'} min="0" step=".01" value={student[field]} onChange={e => setStudent({ ...student, [field]: e.target.value })} /></label>;
      })}
      <label>Заметка<textarea value={student.note} onChange={e => setStudent({ ...student, note: e.target.value })} /></label>
      {error && <p role="alert" className="error">{error}</p>}
      <footer className="actions"><button type="button" onClick={() => { setError(''); setStudent(null); }}>К списку</button><button className="primary">Сохранить</button></footer>
    </form> : <div className="form">
      <button className="primary self-start" onClick={() => { setError(''); setStudent(newStudent()); }}>Добавить ученика</button>
      {!students.length && <p className="muted">Список пока пуст.</p>}
      {[false, true].map(archived => {
        const list = students.filter(s => s.archived === archived);
        return list.length > 0 && <section key={String(archived)}><h3>{archived ? 'Архив' : 'Активные'}</h3>
          {list.map(s => <div className="student-row" key={s.id}><div className="grow"><strong>{s.name}</strong><p className="muted">{[s.subject, s.price && `${s.price} ${currency}`].filter(Boolean).join(' · ')}</p></div>
            <button onClick={() => { setError(''); setStudent(s); }}>Изменить</button><button onClick={() => save({ ...s, archived: !s.archived })}>{archived ? 'Вернуть' : 'В архив'}</button></div>)}
        </section>;
      })}
    </div>}
  </Modal>;
}

export function SettingsForm({ settings, close, save, children }: { settings: Settings; children: ReactNode; close: () => void; save: (settings: Settings) => void }) {
  const [draft, setDraft] = useState(settings);
  const [error, setError] = useState('');
  return <Modal title="Настройки" close={close}>
    <form className="form" onSubmit={event => {
      event.preventDefault();
      const next = { ...draft, currency: draft.currency.trim().toUpperCase(), zone: draft.zone.trim() };
      if (!validSettings(next)) return setError('Проверьте рабочие часы, длительность, трёхбуквенный код валюты и часовой пояс.');
      save(next);
    }}>
      <div className="form-row">
        <label>Начало рабочего дня<input required type="time" value={time(draft.start)} onChange={e => setDraft({ ...draft, start: minutes(e.target.value) })} /></label>
        <label>Конец рабочего дня<input required type="time" value={time(draft.end)} onChange={e => setDraft({ ...draft, end: minutes(e.target.value) })} /></label>
      </div>
      <div className="form-row">
        <label>Длительность, мин<input required type="number" min="1" max="1439" value={draft.duration || ''} onChange={e => setDraft({ ...draft, duration: Number(e.target.value) })} /></label>
        <label>Валюта<input required maxLength={3} value={draft.currency} onChange={e => setDraft({ ...draft, currency: e.target.value })} /></label>
      </div>
      <label>Часовой пояс<input required list="zones" value={draft.zone} onChange={e => setDraft({ ...draft, zone: e.target.value })} /></label>
      <datalist id="zones">{['Europe/Minsk', 'Europe/Moscow', 'Europe/Warsaw', 'Europe/Vilnius', 'UTC', ...Intl.supportedValuesOf('timeZone')].map((zone, i) => <option key={i} value={zone} />)}</datalist>
      <label className="check"><input type="checkbox" checked={draft.weekends} onChange={e => setDraft({ ...draft, weekends: e.target.checked })} />Показывать выходные</label>
      {error && <p role="alert" className="error">{error}</p>}
      <footer className="actions"><button type="button" onClick={close}>Отмена</button><button className="primary">Сохранить</button></footer>
    </form>
    {children}
  </Modal>;
}
