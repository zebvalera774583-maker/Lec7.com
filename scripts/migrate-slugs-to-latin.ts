/**
 * Миграция существующих slug'ов с кириллицей на латиницу
 * 
 * Запуск:
 *   npx tsx scripts/migrate-slugs-to-latin.ts
 * 
 * Или через Node:
 *   npx ts-node scripts/migrate-slugs-to-latin.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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
 * Генерация slug из строки (только латиница: a-z0-9-)
 */
function generateSlug(name: string): string {
  const transliterated = transliterate(name)
  return transliterated
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Проверка, содержит ли slug не-ASCII символы (кириллицу и т.д.)
 */
function hasNonAscii(slug: string): boolean {
  return /[^a-z0-9-]/.test(slug.toLowerCase())
}

async function main() {
  console.log('🔍 Поиск бизнесов с не-ASCII slug...')

  // Находим все бизнесы
  const businesses = await prisma.business.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
    },
  })

  // Фильтруем те, у которых slug содержит не-ASCII
  const businessesToMigrate = businesses.filter((b) => hasNonAscii(b.slug))

  if (businessesToMigrate.length === 0) {
    console.log('✅ Все slug уже в латинице. Миграция не требуется.')
    return
  }

  console.log(`📋 Найдено ${businessesToMigrate.length} бизнесов для миграции:`)
  businessesToMigrate.forEach((b) => {
    console.log(`  - ${b.name}: "${b.slug}"`)
  })

  console.log('\n🔄 Начинаем миграцию...\n')

  let migrated = 0
  let errors = 0

  for (const business of businessesToMigrate) {
    try {
      // Генерируем новый slug из имени бизнеса
      let newSlug = generateSlug(business.name)

      // Если slug пустой (например, только спецсимволы), используем fallback
      if (!newSlug) {
        newSlug = `business-${business.id.slice(0, 8)}`
      }

      // Проверяем уникальность и добавляем суффикс если нужно
      let finalSlug = newSlug
      let counter = 1

      while (true) {
        const existing = await prisma.business.findUnique({
          where: { slug: finalSlug },
          select: { id: true },
        })

        // Если slug свободен или это тот же бизнес - используем его
        if (!existing || existing.id === business.id) {
          break
        }

        // Иначе добавляем суффикс
        finalSlug = `${newSlug}-${counter}`
        counter++
      }

      // Обновляем slug
      await prisma.business.update({
        where: { id: business.id },
        data: { slug: finalSlug },
      })

      console.log(`✅ ${business.name}: "${business.slug}" → "${finalSlug}"`)
      migrated++
    } catch (error) {
      console.error(`❌ Ошибка при миграции ${business.name} (${business.id}):`, error)
      errors++
    }
  }

  console.log(`\n✨ Миграция завершена:`)
  console.log(`   Успешно: ${migrated}`)
  if (errors > 0) {
    console.log(`   Ошибок: ${errors}`)
  }
}

main()
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
