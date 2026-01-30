/**
 * ВРЕМЕННЫЙ скрипт для восстановления пароля пользователя test@lec7.com
 * 
 * ВНИМАНИЕ: Это одноразовый скрипт для production. Удалить после использования!
 * 
 * Запуск:
 *   docker-compose exec app node scripts/reset-test-user-password.mjs
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function resetTestUserPassword() {
  try {
    const email = 'test@lec7.com'
    const newPassword = 'Test12345!'

    console.log('=== Восстановление пароля пользователя ===\n')
    console.log(`Email: ${email}`)
    console.log(`Новый пароль: ${newPassword}\n`)

    // Находим пользователя
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
    })

    if (!user) {
      throw new Error(`Пользователь ${email} не найден в БД`)
    }

    console.log(`✓ Пользователь найден:`)
    console.log(`  ID: ${user.id}`)
    console.log(`  Email: ${user.email}`)
    console.log(`  Имя: ${user.name || '(не указано)'}`)
    console.log(`  Роль: ${user.role}\n`)

    // Хэшируем пароль тем же методом, что используется в login (bcrypt, 10 раундов)
    console.log('Хэширование пароля...')
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    console.log('✓ Пароль хэширован\n')

    // Обновляем только пароль, не трогая другие поля
    console.log('Обновление пароля в БД...')
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    })
    console.log('✓ Пароль успешно обновлён\n')

    // Проверяем, что пароль работает
    console.log('Проверка нового пароля...')
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true },
    })

    const isValid = await bcrypt.compare(newPassword, updatedUser.password)
    if (!isValid) {
      throw new Error('Ошибка: новый пароль не проходит проверку')
    }
    console.log('✓ Пароль проверен и работает\n')

    console.log('=== РЕЗУЛЬТАТ ===')
    console.log(`Пользователь: ${email}`)
    console.log(`Новый пароль: ${newPassword}`)
    console.log(`Статус: ✓ Пароль успешно восстановлен`)
    console.log('\n⚠ ВАЖНО: Удалите этот скрипт после использования!')

  } catch (error) {
    console.error('\n✗ Ошибка:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

resetTestUserPassword()
