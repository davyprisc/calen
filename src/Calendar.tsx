import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { addDays, dateText, monday, shortDays, time, weekday, weekdays, type Data, type Lesson } from './model';

const scale = 1.3;

function lanes(lessons: Lesson[]) {
  const groups: { lesson: Lesson; lane: number }[][] = [];
  let ends: number[] = [];
  let group: typeof groups[number] = [];
  for (const lesson of [...lessons].sort((a, b) => a.start - b.start || b.end - a.end)) {
    if (ends.every(end => end <= lesson.start)) {
      group = [];
      groups.push(group);
      ends = [];
    }
    let lane = ends.findIndex(end => end <= lesson.start);
    if (lane < 0) lane = ends.length;
    ends[lane] = lesson.end;
    group.push({ lesson, lane });
  }
  return groups.flatMap(items => {
    const width = 100 / (1 + Math.max(...items.map(item => item.lane)));
    return items.map(item => ({ ...item, width }));
  });
}

type Gesture = { lesson: Lesson; resize: boolean; x: number; y: number; offset: number };
type Props = {
  data: Data; lessons: Lesson[]; date: string; now: { date: string; minute: number };
  create: (date: string, start: number) => void; edit: (lesson: Lesson) => void;
  move: (lesson: Lesson, next: Lesson, resize: boolean) => void;
};

export function Calendar({ data, lessons, date, now, create, edit, move }: Props) {
  const { start, end, weekends } = data.settings;
  const week = monday(date);
  const dates = Array.from({ length: weekends ? 7 : 5 }, (_, i) => addDays(week, i));
  const slots = Array.from({ length: Math.ceil((end - start) / 30) }, (_, i) => start + i * 30);
  const scroll = useRef<HTMLDivElement>(null);
  const hasLessons = lessons.length > 0;
  useEffect(() => {
    const lastVisible = addDays(week, weekends ? 6 : 4);
    const earliest = Math.min(...lessons.filter(item => item.date >= week && item.date <= lastVisible && item.end > start && item.start < end).map(item => item.start));
    if (scroll.current && Number.isFinite(earliest)) scroll.current.scrollTop = Math.max(0, (earliest - start - 60) * scale);
  }, [week, weekends, start, end, hasLessons]);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const [preview, setPreview] = useState<Lesson | null>(null);

  function begin(event: PointerEvent<HTMLElement>, lesson: Lesson, resize = false) {
    if (event.button !== 0) return;
    const day = event.currentTarget.closest<HTMLElement>('[data-day]');
    if (!day) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { lesson, resize, x: event.clientX, y: event.clientY, offset: event.clientY - day.getBoundingClientRect().top - (lesson.start - start) * scale };
  }

  function target(event: PointerEvent<HTMLElement>) {
    const active = gesture.current;
    if (!active || Math.hypot(event.clientX - active.x, event.clientY - active.y) < 5) return null;
    const day = active.resize ? event.currentTarget.closest<HTMLElement>('[data-day]') : document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-day]');
    if (!day?.dataset.day) return null;
    const { lesson } = active;
    const snap = (n: number) => Math.round(n / 15) * 15;
    if (active.resize) {
      const bottom = snap(lesson.end + (event.clientY - active.y) / scale);
      const min = Math.ceil((lesson.start + 1) / 15) * 15;
      const max = Math.floor(end / 15) * 15;
      return min <= max ? { ...lesson, end: Math.min(max, Math.max(min, bottom)) } : null;
    }
    const duration = lesson.end - lesson.start;
    const min = Math.ceil(start / 15) * 15;
    const max = Math.floor((end - duration) / 15) * 15;
    if (max < min) return null;
    const top = start + (event.clientY - day.getBoundingClientRect().top - active.offset) / scale;
    const nextStart = Math.max(min, Math.min(max, snap(top)));
    return { ...lesson, date: day.dataset.day, start: nextStart, end: nextStart + duration };
  }

  function finish(event: PointerEvent<HTMLElement>) {
    const active = gesture.current;
    const next = target(event);
    gesture.current = null;
    setPreview(null);
    if (!active || Math.hypot(event.clientX - active.x, event.clientY - active.y) < 5) return;
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 0);
    if (next && (next.date !== active.lesson.date || next.start !== active.lesson.start || next.end !== active.lesson.end)) move(active.lesson, next, active.resize);
  }

  const students = new Map(data.students.map(student => [student.id, student.name]));
  const lessonsOn = (day: string) => lessons.filter(item => item.date === day && item.end > start && item.start < end);
  return <>
  <div className="mobile-week" aria-label="Расписание на неделю">
    {dates.map(day => {
      const dailyLessons = lessonsOn(day).sort((a, b) => a.start - b.start || a.end - b.end);
      return <section key={day} className={`mobile-day ${day === now.date ? 'current' : ''}`} aria-label={`${weekdays[weekday(day)]}, ${dateText(day)}`}>
        <header className="mobile-day-header">
          <div><h2>{weekdays[weekday(day)]}</h2><time dateTime={day}>{dateText(day)}</time></div>
          <button className="free-button" aria-label={`Добавить занятие · ${dateText(day)}`} onClick={() => create(day, start)}>＋ Занятие</button>
        </header>
        {dailyLessons.length ? <ul className="mobile-lessons">{dailyLessons.map(lesson =>
          <li key={lesson.id}><button className={`mobile-lesson ${lessonColor(lesson)}`} onClick={() => edit(lesson)}>
            <span className="mobile-time">{time(lesson.start)}–{time(lesson.end)}</span>
            <span className="mobile-lesson-info"><strong>{students.get(lesson.studentId)}</strong><span className="subject">{lesson.subject}</span><LessonStatus lesson={lesson} /></span>
          </button></li>
        )}</ul> : <p className="mobile-empty">Занятий нет</p>}
      </section>;
    })}
  </div>
  <div ref={scroll} className="schedule" aria-label="Расписание занятий">
    <div className="schedule-grid" style={{ gridTemplateColumns: `62px repeat(${dates.length}, minmax(102px, 1fr))` }}>
      <div className="grid-head hours-head">Время</div>
      {dates.map(day => <div key={day} className={'grid-head ' + (day === now.date ? 'current' : '')}>
        <span>{weekdays[weekday(day)]}</span><strong>{dateText(day)}</strong>
      </div>)}
      <div className="ruler">
        {slots.map((slot, i) => i % 2 === 0 && <span key={slot} style={{ top: (slot - start) * scale }}>{time(slot)}</span>)}
      </div>
      {dates.map(day => <div key={day} data-day={day} className={'day ' + (day === now.date ? 'current' : '')} style={{ height: (end - start) * scale }}>
        {slots.map((slot, i) => <button key={slot} className={'slot ' + (i % 2 ? 'half' : '')} style={{ height: Math.min(30, end - slot) * scale }}
          aria-label={`Добавить занятие · ${shortDays[weekday(day)]} ${dateText(day)} ${time(slot)}`} onClick={() => create(day, slot)} />)}
        {lanes(lessonsOn(day)).map(({ lesson, lane, width }) => {
          const name = students.get(lesson.studentId) ?? '';
          const details = `${time(lesson.start)}–${time(lesson.end)} · ${name} · ${lesson.subject} · ${lesson.status} · ${lesson.paid ? 'Оплачено' : 'Не оплачено'}`;
          return <div key={lesson.id} className={`lesson ${lessonColor(lesson)} ${preview?.id === lesson.id ? 'moving' : ''}`}
            style={{ top: (Math.max(lesson.start, start) - start) * scale, height: (Math.min(lesson.end, end) - Math.max(lesson.start, start)) * scale, left: `calc(${lane * width}% + 2px)`, width: `calc(${width}% - 4px)` }}
            onPointerMove={event => setPreview(target(event))} onPointerUp={finish} onPointerCancel={() => { gesture.current = null; setPreview(null); }}>
            <button className="lesson-body" aria-label={details} title={details} onPointerDown={event => begin(event, lesson)} onClick={() => { if (!suppressClick.current) edit(lesson); }}>
              <span>{time(lesson.start)}–{time(lesson.end)}</span>
              <strong>{name}</strong><span className="subject">{lesson.subject}</span>
              <LessonStatus lesson={lesson} />
            </button>
            {lesson.end <= end && <div className="resize" title="Изменить длительность" onPointerDown={event => begin(event, lesson, true)} />}
          </div>;
        })}
        {preview?.date === day && <div className="drag-preview" style={{ top: (Math.max(preview.start, start) - start) * scale, height: (Math.min(preview.end, end) - Math.max(preview.start, start)) * scale }}>{time(preview.start)}–{time(preview.end)}</div>}
        {day === now.date && now.minute >= start && now.minute < end && <div className="now-line" style={{ top: (now.minute - start) * scale }} title={time(now.minute)} />}
      </div>)}
    </div>
  </div>
  </>;
}

function lessonColor(lesson: Lesson) {
  if (lesson.status === 'Отменено') return 'lesson-cancelled';
  if (lesson.status === 'Проведено') return 'lesson-completed';
  if (lesson.status === 'Пропуск') return 'lesson-occupied';
  return lesson.paid ? 'lesson-confirmed' : 'lesson-pending';
}

function LessonStatus({ lesson }: { lesson: Lesson }) {
  const status = lesson.status === 'Запланировано' ? (lesson.paid ? 'Подтверждено' : 'Ожидает оплаты') : lesson.status;
  return <span className="lesson-state">{status}{(lesson.paid || lesson.status !== 'Запланировано') && <span className="payment">{lesson.paid ? 'Оплачено' : 'Не оплачено'}</span>}</span>;
}
