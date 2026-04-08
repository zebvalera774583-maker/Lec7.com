export interface TestSignal {
  receivedAt: string
  source: string
  chatId: string
  chatTitle: string
  username: string
  text: string
  messageLink: string
}

const testSignals: TestSignal[] = []

export function getTestSignals(): readonly TestSignal[] {
  return testSignals
}

export function appendTestSignal(signal: TestSignal): void {
  testSignals.push(signal)
}
