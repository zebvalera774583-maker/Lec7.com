/**
 * Скрипт для сброса пароля администратора
 * 
 * Использование:
 *   EMAIL=zebvalera774583@gmail.com NEW_PASS=your_new_password node scripts/reset-admin-password.mjs
 * 
 * Или на сервере через Docker:
 *   docker-compose exec app env EMAIL=zebvalera774583@gmail.com NEW_PASS=your_new_password node scripts/reset-admin-password.mjs
 * 
 * ВАЖНО: Использует bcryptjs с 10 раундами (как в lib/auth.ts)
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function resetAdminPassword() {
  try {
    const email = process.env.EMAIL
    const newPassword = process.env.NEW_PASS

    if (!email || !newPassword) {
      throw new Error('Требуются переменные окружения: EMAIL и NEW_PASS')
    }

    if (newPassword.length < 6) {
      throw new Error('Пароль должен быть не менее 6 символов')
    }

    console.log('=== Сброс пароля администратора ===\n')
    console.log(`Email: ${email}`)
    console.log(`Длина пароля: ${newPassword.length} символов\n`)

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true,
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

    // Хэшируем пароль тем же методом, что используется в login (bcryptjs, 10 раундов)
    // Это соответствует lib/auth.ts: hashPassword()
    console.log('Хэширование пароля (bcryptjs, 10 раундов)...')
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    console.log('✓ Пароль хэширован\n')

    // Обновляем только поле password
    console.log('Обновление пароля в БД...')
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    })
    console.log('✓ Пароль успешно обновлён в поле "password"\n')

    // Проверяем, что пароль работает (используя bcrypt.compare как в lib/auth.ts)
    console.log('Проверка нового пароля (bcrypt.compare)...')
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true },
    })

    const isValid = await bcrypt.compare(newPassword, updatedUser.password)
    if (!isValid) {
      throw new Error('Ошибка: новый пароль не проходит проверку bcrypt.compare')
    }
    console.log('✓ Пароль проверен и работает\n')

    console.log('=== РЕЗУЛЬТАТ ===')
    console.log(`Пользователь: ${email}`)
    console.log(`Роль: ${user.role}`)
    console.log(`Статус: ✓ Пароль успешно сброшен`)
    console.log(`\nТеперь можно войти через POST /api/auth/login`)
    console.log(`Поле в БД: password (хешировано через bcryptjs)`)
    console.log(`\nOK`)

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

resetAdminPassword()
