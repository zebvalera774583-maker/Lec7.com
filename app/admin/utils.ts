import { execSync } from 'child_process'

/**
 * Безопасное получение git branch.
 * В продакшене может не работать execSync (нет git в контейнере),
 * поэтому используем fallback на process.env.GIT_BRANCH.
 */
export function getGitBranchSafe(): string | undefined {
  // Сначала пробуем получить из env (для продакшена)
  if (process.env.GIT_BRANCH) {
    return process.env.GIT_BRANCH
  }

  // Пробуем execSync (для локальной разработки)
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return branch || undefined
  } catch {
    // Если git недоступен или произошла ошибка, возвращаем undefined
    return undefined
  }
}
