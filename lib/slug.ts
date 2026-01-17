/**
 * Транслитерация кириллицы в латиницу
 */
function transliterate(text: string): string {
  const cyrillicToLatin: { [key: string]: string } = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'yo',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
    А: 'A',
    Б: 'B',
    В: 'V',
    Г: 'G',
    Д: 'D',
    Е: 'E',
    Ё: 'Yo',
    Ж: 'Zh',
    З: 'Z',
    И: 'I',
    Й: 'Y',
    К: 'K',
    Л: 'L',
    М: 'M',
    Н: 'N',
    О: 'O',
    П: 'P',
    Р: 'R',
    С: 'S',
    Т: 'T',
    У: 'U',
    Ф: 'F',
    Х: 'H',
    Ц: 'Ts',
    Ч: 'Ch',
    Ш: 'Sh',
    Щ: 'Sch',
    Ъ: '',
    Ы: 'Y',
    Ь: '',
    Э: 'E',
    Ю: 'Yu',
    Я: 'Ya',
  }

  return text
    .split('')
    .map((char) => cyrillicToLatin[char] || char)
    .join('')
}

/**
 * Генератор slug из строки (только латиница: a-z0-9-)
 * Транслитерирует кириллицу в латиницу перед slugify
 */
export function generateSlug(name: string): string {
  // Сначала транслитерируем кириллицу
  const transliterated = transliterate(name)

  // Затем создаём slug только из латиницы
  return transliterated
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '') // Только a-z, 0-9, дефис
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Проверка, содержит ли строка только латинские буквы, цифры, пробелы и дефисы
 * Используется для валидации displayName и name
 */
export function isLatinOnly(text: string): boolean {
  // Разрешаем: латинские буквы (a-z, A-Z), цифры (0-9), пробелы, дефисы
  return /^[a-zA-Z0-9\s-]+$/.test(text)
}

/**
 * Проверка, содержит ли строка кириллицу
 */
export function hasCyrillic(text: string): boolean {
  return /[а-яёА-ЯЁ]/.test(text)
}
