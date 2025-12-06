// WebSocket functionality temporarily disabled for UI development
// TODO: Implement WebSocket system after UI is complete

export class WebSocketService {
  static initialize() {
    console.log('WebSocket initialization skipped for now')
  }

  static emit(event: string, data: any) {
    console.log('WebSocket emit:', { event, data })
  }

  static on(event: string, callback: Function) {
    console.log('WebSocket listener registered:', event)
  }
}