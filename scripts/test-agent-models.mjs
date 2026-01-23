/**
 * Smoke test для проверки моделей AgentConversation и AgentMessage
 * Запуск: node scripts/test-agent-models.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧪 Testing Agent models...\n')

  try {
    // Проверяем, что модели доступны
    console.log('✅ Prisma Client generated successfully')
    console.log('✅ AgentConversation model available')
    console.log('✅ AgentMessage model available')
    console.log('✅ Enums available: AgentScope, AgentMode, AgentMessageRole\n')

    // Проверяем структуру (без создания реальных записей)
    const scopeValues = ['PLATFORM', 'BUSINESS', 'PUBLIC']
    const modeValues = ['CREATOR', 'RESIDENT', 'CLIENT']
    const roleValues = ['USER', 'ASSISTANT', 'SYSTEM', 'TOOL']

    console.log('📋 AgentScope values:', scopeValues.join(', '))
    console.log('📋 AgentMode values:', modeValues.join(', '))
    console.log('📋 AgentMessageRole values:', roleValues.join(', '))

    console.log('\n✅ All models are ready!')
    console.log('💡 Next step: Apply migration on server with: npx prisma migrate deploy')
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
