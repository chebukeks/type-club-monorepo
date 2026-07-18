import { Plugin, PluginKey } from 'prosemirror-state'
import { closeHistory } from 'prosemirror-history'

export const typographyPluginKey = new PluginKey('typographyPlugin')

/**
 * Плагин для умной типографики.
 * Заменяет `--` на `—` (em-dash) или `–` (en-dash).
 * Использует `handleTextInput`, что гарантирует:
 * 1. Работает ТОЛЬКО при физическом наборе текста (а не при удалении, отмене Ctrl+Z или вставке).
 * 2. Благодаря асинхронности и closeHistory ложится в отдельный шаг истории,
 *    что позволяет отменять автозамену по одному нажатию Ctrl+Z, сохраняя исходный ввод.
 */
export function typographyPlugin(): Plugin {
  return new Plugin({
    key: typographyPluginKey,
    props: {
      handleTextInput(view, _from, _to, text) {
        // Проверяем, ввели ли мы пробел (для em-dash) или букву/цифру (для en-dash)
        // Это быстрая отсечка, чтобы не запускать логику на каждую рандомную клавишу.
        if (!/[\s\u00A0\p{L}\p{N}]/u.test(text)) {
          return false // Пропускаем дальше (символ просто напечатается)
        }

        // Ждем 5 миллисекунд, чтобы символ (text) сначала физически вставился
        // в документ ProseMirror, и стал доступен в view.state
        setTimeout(() => {
          const state = view.state
          const { $head, empty } = state.selection
          if (!empty) return

          // Достаем текст перед курсором (последние ~10 символов)
          const before = $head.parent.textBetween(
            Math.max(0, $head.parentOffset - 10),
            $head.parentOffset,
            undefined,
            '\ufffc'
          )

          if (!before) return

          let matchStr = ""

          // Правило 1: " -- " -> " — "
          const emDashMatch = before.match(/([\s\u00A0])--([\s\u00A0])$/);
          if (emDashMatch) {
            matchStr = `${emDashMatch[1]}—${emDashMatch[2]}`
          }

          // Правило 2: "[\p{L}\p{N}]--[\p{L}\p{N}]" -> "[\p{L}\p{N}]–[\p{L}\p{N}]"
          const enDashMatch = before.match(/([\p{L}\p{N}])--([\p{L}\p{N}])$/u);
          if (enDashMatch && !matchStr) {
            matchStr = `${enDashMatch[1]}–${enDashMatch[2]}`
          }

          // Правило 3: "-- " в самом начале строки (ничего слева, пробел справа) -> "— "
          // ProseMirror может заменить обычный пробел на неразрывный (U+00A0) в начале параграфа
          if (!matchStr && $head.parentOffset >= 3) {
            const fromStart = $head.parent.textBetween(0, $head.parentOffset, null, '\ufffc')
            if (fromStart.length === 3 && fromStart[0] === '-' && fromStart[1] === '-' && /[\s\u00A0]/.test(fromStart[2])) {
              matchStr = `—${fromStart[2]}`
            }
          }

          if (matchStr) {
            // Захватываем точные координаты на момент ввода
            // Правила 1-2 (X--Y): 4 символа, Правило 3 (-- ): 3 символа
            const matchLen = matchStr.length
            const startPos = $head.pos - (matchLen + 1)
            const endPos = $head.pos

            // Вызываем пустую транзакцию, закрывающую историю.
            // Это принудительно обрывает 500-миллисекундный таймер группировки ввода ProseMirror,
            // изолируя последние нажатия пользователя (включая только что введенный символ) в отдельный шаг!
            const closeTr = view.state.tr
            closeHistory(closeTr)
            view.dispatch(closeTr)

            // Теперь применяем саму замену. Она попадёт в новую свежую группу истории.
            // И значит Ctrl+Z будет отменять ТОЛЬКО её!
            const tr = view.state.tr.replaceWith(
              startPos,
              endPos,
              view.state.schema.text(matchStr)
            )
            tr.setMeta(typographyPluginKey, true)
            view.dispatch(tr)
          }
        }, 5)

        return false // Важно вернуть false, чтобы символ НОРМАЛЬНО вставился в текст!
      }
    }
  })
}
