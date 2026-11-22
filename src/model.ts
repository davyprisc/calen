export const statuses = ['Запланировано', 'Проведено', 'Отменено', 'Пропуск'] as const;
export const weekdays = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
export const shortDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export type Student = { id: string; name: string; subject: string; price: string; contact: string; note: string; archived: boolean };
export type Lesson = { id: string; studentId: string; subject: string; date: string; start: number; end: number; format: 'Онлайн' | 'Очно'; location: string; price: string; status: typeof statuses[number]; paid: boolean; note: string; series?: string; occurrence?: string };
export type Settings = { start: number; end: number; duration: number; currency: string; zone: string; weekends: boolean };
export type Data = { version: 1; students: Student[]; lessons: Lesson[]; settings: Settings };
export const empty: Data = { version: 1, students: [], lessons: [], settings: { start: 480, end: 1320, duration: 60, currency: 'BYN', zone: 'Europe/Minsk', weekends: true } };
export const key = 'calen-data-v1';
export const uid = () => crypto.randomUUID();
export const dateText = (date: string) => date.split('-').reverse().join('.');
export const time = (value: number) => [Math.floor(value / 60), value % 60].map(n => String(n).padStart(2, '0')).join(':');
export const minutes = (value: string) => {
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
};
export function addDays(date: string, days: number) {
  const result = new Date(date + 'T00:00:00Z');
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
export function daysBetween(first: string, second: string) {
  return (Date.parse(second) - Date.parse(first)) / 86400000;
}
export const weekday = (date: string) => (new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7;
export const monday = (date: string) => addDays(date, -weekday(date));
export function clock(zone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts();
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return { date: [get('year'), get('month'), get('day')].join('-'), minute: minutes(get('hour') + ':' + get('minute')) };
}
export function repeatDates(start: string, end: string, selected: number[]) {
  if (!validDate(start) || !validDate(end) || end < start || !selected.length) return [];
  return Array.from({ length: daysBetween(start, end) + 1 }, (_, index) => addDays(start, index)).filter(date => selected.includes(weekday(date)));
}
export function overlaps(a: Lesson, b: Lesson) {
  return a.date === b.date && a.start < b.end && b.start < a.end && a.status !== 'Отменено' && b.status !== 'Отменено';
}
export function affected(lessons: Lesson[], lesson: Lesson, future: boolean) {
  return lessons.filter(item => item.id === lesson.id || (future && lesson.series && item.series === lesson.series && (item.occurrence ?? item.date) >= (lesson.occurrence ?? lesson.date)));
}
export function revise(items: Lesson[], original: Lesson, next: Lesson) {
  const shift = daysBetween(original.date, next.date);
  const editable = ['studentId', 'subject', 'start', 'end', 'format', 'location', 'price', 'status', 'paid', 'note'] as const;
  const changes = Object.fromEntries(editable.filter(field => original[field] !== next[field]).map(field => [field, next[field]]));
  return items.map(item => ({ ...item, ...changes, date: addDays(item.date, shift) }));
}
const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value) && value >= '1900-01-01' && value <= '2100-12-31' && Number.isFinite(Date.parse(value)) && addDays(value, 0) === value;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const str = (value: unknown): value is string => typeof value === 'string';
const nonempty = (value: unknown): value is string => str(value) && Boolean(value.trim());
const integer = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
export const validPrice = (value: unknown) => str(value) && (value === '' || /^\d+(\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value)));
export function validZone(value: unknown) {
  if (!nonempty(value)) return false;
  try { new Intl.DateTimeFormat('ru', { timeZone: value }); return true; }
  catch { return false; }
}
export function validSettings(s: unknown): s is Settings {
  return object(s) && integer(s.start, 0, 1438) && integer(s.end, s.start + 1, 1439) && integer(s.duration, 1, 1439) && str(s.currency) && /^[A-Z]{3}$/.test(s.currency) && validZone(s.zone) && typeof s.weekends === 'boolean';
}
export function parseData(raw: string): Data {
  const value: unknown = JSON.parse(raw);
  if (!object(value) || value.version !== 1 || !Array.isArray(value.students) || !Array.isArray(value.lessons) || !validSettings(value.settings)) throw new Error('Неверный формат резервной копии.');
  const students = new Set<string>();
  for (const student of value.students) {
    if (!object(student) || !nonempty(student.id) || students.has(student.id) || !nonempty(student.name) || !str(student.subject) || !validPrice(student.price) || !str(student.contact) || !str(student.note) || typeof student.archived !== 'boolean') throw new Error('Проверьте записи учеников в файле.');
    students.add(student.id);
  }
  const lessons = new Set<string>();
  for (const lesson of value.lessons) {
    if (!object(lesson) || !nonempty(lesson.id) || lessons.has(lesson.id) || !str(lesson.studentId) || !students.has(lesson.studentId) || !nonempty(lesson.subject) || !validDate(lesson.date) || !integer(lesson.start, 0, 1438) || !integer(lesson.end, lesson.start + 1, 1439) || !statuses.some(status => status === lesson.status) || typeof lesson.paid !== 'boolean' || !['Онлайн', 'Очно'].some(format => format === lesson.format) || !str(lesson.location) || !validPrice(lesson.price) || !str(lesson.note) || (lesson.series !== undefined && !nonempty(lesson.series)) || (lesson.occurrence !== undefined && !validDate(lesson.occurrence))) throw new Error('Проверьте записи занятий в файле.');
    lessons.add(lesson.id);
  }
  return value as Data;
}
export function sample(data: Data, date: string): Data {
  const students: Student[] = [
    ['Мирон Листопад', 'Математика', '35'],
    ['Алиса Северина', 'Английский язык', '40'],
    ['София Верескова', 'Физика', '38'],
    ['Даниил Лунарев', 'Информатика', '45'],
  ].map(([name, subject, price]) => ({ id: uid(), name, subject, price, contact: '', note: '', archived: false }));
  const first = monday(date);
  const lessons: Lesson[] = [[0, 960, 0], [0, 1050, 1], [1, 990, 2], [2, 930, 0], [2, 1050, 3], [3, 990, 1], [4, 1020, 2], [6, 960, 3]].map(([day, start, index], i) => ({
    id: uid(), studentId: students[index].id, subject: students[index].subject, date: addDays(first, day), start, end: start + 60, price: students[index].price, status: statuses[i % 4], paid: i % 3 === 0, format: 'Онлайн', location: '', note: '',
  }));
  return { ...data, students: [...data.students, ...students], lessons: [...data.lessons, ...lessons] };
}
