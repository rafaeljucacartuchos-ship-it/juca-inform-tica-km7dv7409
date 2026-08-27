import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FileDown,
  Loader2,
  RefreshCw,
  PlusCircle,
  XCircle,
  Info,
  Users,
} from 'lucide-react'
import {
  parseClientsFile,
  importClientsData,
  downloadClientsTemplate,
  type ParsedCustomerRow,
  type ImportClientsSummary,
} from '@/lib/client-excel'

interface ImportClientsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type Step = 'upload' | 'preview' | 'importing' | 'summary'

export function ImportClientsModal({ open, onOpenChange, onSuccess }: ImportClientsModalProps) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedCustomerRow[]>([])
  const [loadingFile, setLoadingFile] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  // Progresso
  const [progress, setProgress] = useState(0)
  const [processedCount, setProcessedCount] = useState(0)

  // Resultado
  const [summary, setSummary] = useState<ImportClientsSummary | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleReset = () => {
    setStep('upload')
    setFile(null)
    setParsedRows([])
    setLoadingFile(false)
    setFileError(null)
    setProgress(0)
    setProcessedCount(0)
    setSummary(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = (isOpen: boolean) => {
    if (step === 'importing') return
    if (!isOpen) {
      handleReset()
    }
    onOpenChange(isOpen)
  }

  const handleFileChange = async (selectedFile: File | undefined) => {
    if (!selectedFile) return
    setFileError(null)

    const validExtensions = ['.xlsx', '.xls', '.csv', '.html', '.htm', '.txt', '.tsv']
    const hasValidExt = validExtensions.some((ext) => selectedFile.name.toLowerCase().endsWith(ext))

    if (!hasValidExt) {
      setFileError('Por favor selecione um arquivo Excel (.xlsx, .xls), .csv ou .html válido.')
      return
    }

    setFile(selectedFile)
    setLoadingFile(true)
    try {
      const rows = await parseClientsFile(selectedFile)
      if (rows.length === 0) {
        throw new Error('Nenhum cliente válido encontrado no arquivo.')
      }
      setParsedRows(rows)
      setStep('preview')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao ler arquivo.'
      setFileError(msg)
      setFile(null)
    } finally {
      setLoadingFile(false)
    }
  }

  const handleStartImport = async () => {
    if (parsedRows.length === 0) return
    setStep('importing')
    setProgress(0)
    setProcessedCount(0)

    try {
      const result = await importClientsData(parsedRows, (current, total) => {
        setProcessedCount(current)
        setProgress(Math.round((current / total) * 100))
      })

      setSummary(result)
      setStep('summary')
      if (onSuccess) onSuccess()

      toast({
        title: 'Importação de clientes concluída!',
        description: `${result.updated} atualizados, ${result.created} criados, ${result.errors} erros.`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na importação.'
      toast({
        title: 'Erro durante a importação',
        description: msg,
        variant: 'destructive',
      })
      setStep('preview')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-full sm:max-w-[660px] h-full sm:h-auto max-h-screen sm:max-h-[90vh] rounded-none sm:rounded-lg flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 text-indigo-600">
            <Upload className="h-5 w-5" />
            <DialogTitle className="text-lg font-bold text-slate-900">
              Importar Clientes
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Envie um arquivo Excel (.xlsx, .xls), .csv ou .html para cadastrar e atualizar clientes
            em massa.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-3 space-y-4">
          {/* ETAPA 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (e.dataTransfer.files?.[0]) {
                    handleFileChange(e.dataTransfer.files[0])
                  }
                }}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/70 hover:bg-indigo-50/30 transition-all rounded-xl p-8 text-center cursor-pointer flex flex-col items-center justify-center gap-3"
              >
                <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Clique para selecionar ou arraste a planilha aqui
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Formatos suportados: .xlsx, .xls, .csv ou .html
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs bg-white"
                  disabled={loadingFile}
                >
                  {loadingFile ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Lendo arquivo...
                    </>
                  ) : (
                    'Selecionar Arquivo'
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv, .html, .htm, text/html, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0])}
                />
              </div>

              {fileError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                  <span>{fileError}</span>
                </div>
              )}

              {/* Informações e Modelo */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2 text-slate-600">
                <div className="font-semibold text-slate-800 flex items-center justify-between">
                  <span>Estrutura da Planilha (7 Colunas):</span>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                    onClick={downloadClientsTemplate}
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Baixar Modelo Excel (.xlsx)
                  </Button>
                </div>
                <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-slate-600">
                  <li>
                    <b>Razão Social</b>
                  </li>
                  <li>
                    <b>Nome Fantasia</b>
                  </li>
                  <li>
                    <b>Endereço</b>
                  </li>
                  <li>
                    <b>Bairro</b>
                  </li>
                  <li>
                    <b>Celular</b>
                  </li>
                  <li>
                    <b>RG/IE</b>
                  </li>
                  <li>
                    <b>CPF/CNPJ</b>
                  </li>
                </ol>
                <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                  Atualização inteligente: clientes já existentes com o mesmo CPF/CNPJ, Razão Social
                  ou Nome Fantasia serão atualizados.
                </p>
              </div>
            </div>
          )}

          {/* ETAPA 2: PREVIEW */}
          {step === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 p-2.5 rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
                  <span className="font-medium text-indigo-900 truncate max-w-[260px]">
                    {file?.name}
                  </span>
                </div>
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 text-[11px]">
                  {parsedRows.length} {parsedRows.length === 1 ? 'cliente' : 'clientes'}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Pré-visualização das 7 colunas da planilha:</span>
                <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  {parsedRows.filter((r) => r.statusValido).length} linhas válidas
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-[280px] overflow-y-auto">
                <table className="w-full text-left text-[11px] whitespace-nowrap">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2">Razão Social</th>
                      <th className="p-2">Nome Fantasia</th>
                      <th className="p-2">Endereço</th>
                      <th className="p-2">Bairro</th>
                      <th className="p-2">Celular</th>
                      <th className="p-2">RG/IE</th>
                      <th className="p-2">CPF/CNPJ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parsedRows.slice(0, 30).map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td
                          className="p-2 font-medium text-slate-900 max-w-[150px] truncate"
                          title={r.razao_social}
                        >
                          {r.razao_social || '-'}
                        </td>
                        <td
                          className="p-2 text-slate-700 max-w-[150px] truncate"
                          title={r.nome_fantasia}
                        >
                          {r.nome_fantasia || '-'}
                        </td>
                        <td
                          className="p-2 text-slate-600 max-w-[180px] truncate"
                          title={r.endereco}
                        >
                          {r.endereco || '-'}
                        </td>
                        <td className="p-2 text-slate-600">{r.bairro || '-'}</td>
                        <td className="p-2 font-mono text-slate-700">{r.celular || '-'}</td>
                        <td className="p-2 font-mono text-slate-600">{r.rg_ie || '-'}</td>
                        <td className="p-2 font-mono text-slate-700">{r.cpf_cnpj || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 30 && (
                <p className="text-[11px] text-slate-400 text-center">
                  + {parsedRows.length - 30} clientes adicionais serão processados.
                </p>
              )}
            </div>
          )}

          {/* ETAPA 3: IMPORTANDO */}
          {step === 'importing' && (
            <div className="py-8 space-y-4 text-center">
              <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mx-auto" />
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Processando clientes...</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Importando {processedCount} de {parsedRows.length} clientes ({progress}%)
                </p>
              </div>
              <div className="max-w-md mx-auto">
                <Progress value={progress} className="h-2.5" />
              </div>
            </div>
          )}

          {/* ETAPA 4: RESUMO */}
          {step === 'summary' && summary && (
            <div className="space-y-4 py-2">
              <div className="text-center space-y-1">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                <h3 className="text-base font-bold text-slate-900">Importação Concluída!</h3>
                <p className="text-xs text-slate-500">
                  O processamento da base de clientes foi finalizado com o seguinte resultado:
                </p>
              </div>

              {/* Cards de métricas */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/60 text-center">
                  <div className="flex items-center justify-center gap-1 text-emerald-700 font-semibold text-xs mb-1">
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>Criados</span>
                  </div>
                  <div className="text-xl font-bold text-emerald-700">{summary.created}</div>
                </div>

                <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/60 text-center">
                  <div className="flex items-center justify-center gap-1 text-blue-700 font-semibold text-xs mb-1">
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Atualizados</span>
                  </div>
                  <div className="text-xl font-bold text-blue-700">{summary.updated}</div>
                </div>

                <div className="p-3 rounded-lg border border-red-200 bg-red-50/60 text-center">
                  <div className="flex items-center justify-center gap-1 text-red-700 font-semibold text-xs mb-1">
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Erros</span>
                  </div>
                  <div className="text-xl font-bold text-red-700">{summary.errors}</div>
                </div>
              </div>

              {/* Detalhes de erros, se houver */}
              {summary.errors > 0 && summary.errorDetails.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-[140px] overflow-y-auto text-xs space-y-1 text-red-800">
                  <div className="font-semibold flex items-center gap-1 text-red-900">
                    <AlertTriangle className="h-3.5 w-3.5" /> Detalhes dos erros:
                  </div>
                  {summary.errorDetails.map((err, idx) => (
                    <p key={idx} className="text-[11px]">
                      • {err}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
          {step === 'upload' && (
            <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={handleReset}>
                Escolher Outro Arquivo
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                onClick={handleStartImport}
              >
                <Upload className="h-4 w-4" />
                Importar {parsedRows.length} Clientes
              </Button>
            </>
          )}

          {step === 'summary' && (
            <Button
              type="button"
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => handleClose(false)}
            >
              Concluir
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
