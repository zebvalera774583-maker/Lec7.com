import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { UserRole, AuthRole, AuthUser } from '@/types'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production'

/**
 * Guard-функция для проверки валидности роли
 */
export function isUserRole(value: unknown): value is UserRole {
  return value === 'BUSINESS_OWNER' || value === 'LEC7_ADMIN'
}

/**
 * Хеширование пароля
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

/**
 * Проверка пароля
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

/**
 * Создание JWT токена
 */
export function createToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      businessId: user.businessId,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

/**
 * Верификация JWT токена
 */
export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser
    return decoded
  } catch {
    return null
  }
}

/**
 * Получение пользователя из БД по email
 */
export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: {
      businesses: true,
    },
  })
}

/**
 * Получение пользователя из БД по ID
 */
export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      businesses: true,
    },
  })
}

/**
 * Создание пользователя
 */
export async function createUser(
  email: string,
  password: string,
  name?: string,
  role: UserRole = 'BUSINESS_OWNER'
) {
  const hashedPassword = await hashPassword(password)
  
  return prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role,
    },
  })
}
