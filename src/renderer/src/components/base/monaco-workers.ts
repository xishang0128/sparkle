import CssWorker from 'monaco-editor/language/css/css.worker.js?worker'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker'
import TypeScriptWorker from 'monaco-editor/language/typescript/ts.worker.js?worker'
import YamlWorker from 'monaco-yaml/yaml.worker.js?worker'

export function configureMonacoWorkers(): void {
  globalThis.MonacoEnvironment = {
    getWorker(_workerId, label) {
      switch (label) {
        case 'css':
        case 'less':
        case 'scss':
          return new CssWorker()
        case 'javascript':
        case 'typescript':
          return new TypeScriptWorker()
        case 'json':
          return new JsonWorker()
        case 'yaml':
          return new YamlWorker()
        case 'editorWorkerService':
          return new EditorWorker()
        default:
          throw new Error(`Unsupported Monaco worker: ${label}`)
      }
    }
  }
}
