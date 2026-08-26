import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Eye, Pencil, Trash2, Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Customer } from '@/types'
import { getCustomers, deleteCustomer } from '@/services/customers'
import { NewCustomerModal } from '@/components/NewCustomerModal'
import { ImportClientsModal } from '@/components/ImportClientsModal'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { exportClientsToExcel } from '@/lib/client-excel'

export default function Clientes() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [exportingClients, setExportingClients] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [deleteCustomerItem, setDeleteCustomerItem] = useState<Customer | null>(null)
  const { toast } = useToast()

  const loadData = async () => {
    try {
      const data = await getCustomers(search)
      setCustomers(data)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [search])
  useRealtime('customers', loadData)

  const handleDelete = async () => {
    if (!deleteCustomerItem) return
    try {
      await deleteCustomer(deleteCustomerItem.id)
      toast({ title: 'Cliente excluído com sucesso!' })
      setDeleteCustomerItem(null)
      loadData()
    } catch {
      toast({ title: 'Erro ao excluir cliente', variant: 'destructive' })
    }
  }

  const handleExportAll = async () => {
    setExportingClients(true)
    try {
      const all = await getCustomers('')
      exportClientsToExcel(all, 'clientes.xlsx')
      toast({
        title: 'Planilha exportada com sucesso!',
        description: `${all.length} clientes exportados para clientes.xlsx.`,
      })
    } catch {
      toast({
        title: 'Erro ao exportar clientes',
        variant: 'destructive',
      })
    } finally {
      setExportingClients(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Base de Clientes</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Gerencie os dados de contato, importação, exportação e histórico de chamados dos
            clientes.
          </p>
        </div>

        {/* Grupo de Ações no Topo */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão: Importar Planilha */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportModalOpen(true)}
            className="bg-white border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 gap-1.5 h-9 text-xs font-medium shadow-2xs"
            title="Importar e atualizar clientes em lote via arquivo .xlsx, .xls, .csv ou .html"
          >
            <Upload className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Importar Clientes</span>
          </Button>

          {/* Botão: Exportar Planilha */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            disabled={exportingClients}
            className="bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 gap-1.5 h-9 text-xs font-medium shadow-2xs"
            title="Exportar todos os clientes para planilha Excel (.xlsx)"
          >
            <Download className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{exportingClients ? 'Exportando...' : 'Exportar Planilha'}</span>
          </Button>

          {/* Botão: Novo Cliente */}
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-9 text-xs sm:text-sm font-medium shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Cliente</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por Razão Social, Nome Fantasia, CPF/CNPJ, Celular ou Endereço..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Razão Social</th>
                  <th className="py-3 px-4">Nome Fantasia</th>
                  <th className="py-3 px-4">Endereço</th>
                  <th className="py-3 px-4">Bairro</th>
                  <th className="py-3 px-4">Celular</th>
                  <th className="py-3 px-4">RG/IE</th>
                  <th className="py-3 px-4">CPF/CNPJ</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => {
                  const razaoSocial = c.razao_social || c.name || '-'
                  const nomeFantasia = c.nome_fantasia || c.razao_social || c.name || '-'
                  const endereco = c.endereco || c.street || '-'
                  const bairro = c.bairro || '-'
                  const celular = c.celular || c.phone || '-'
                  const rgIe = c.rg_ie || '-'
                  const cpfCnpj = c.cpf_cnpj || '-'

                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td
                        className="py-3 px-4 font-bold text-slate-900 max-w-[200px] truncate"
                        title={razaoSocial}
                      >
                        {razaoSocial}
                      </td>
                      <td
                        className="py-3 px-4 text-slate-700 max-w-[180px] truncate"
                        title={nomeFantasia}
                      >
                        {nomeFantasia}
                      </td>
                      <td
                        className="py-3 px-4 text-slate-600 max-w-[220px] truncate"
                        title={endereco}
                      >
                        {endereco}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{bairro}</td>
                      <td className="py-3 px-4 font-mono text-slate-700 font-medium">{celular}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{rgIe}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">{cpfCnpj}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/clientes/${c.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-indigo-600 gap-1"
                              title="Ver detalhes"
                            >
                              <Eye className="h-3.5 w-3.5" /> Detalhes
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-amber-600 gap-1"
                            onClick={() => setEditCustomer(c)}
                            title="Editar cliente"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-600"
                            onClick={() => setDeleteCustomerItem(c)}
                            title="Excluir cliente"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Nenhum cliente cadastrado ou encontrado na busca.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <NewCustomerModal open={modalOpen} onOpenChange={setModalOpen} onCreated={loadData} />
      <NewCustomerModal
        open={!!editCustomer}
        onOpenChange={(o) => !o && setEditCustomer(null)}
        onCreated={loadData}
        editCustomer={editCustomer}
      />
      <ImportClientsModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onSuccess={loadData}
      />
      <ConfirmDeleteDialog
        open={!!deleteCustomerItem}
        onOpenChange={(o) => !o && setDeleteCustomerItem(null)}
        onConfirm={handleDelete}
        title="Excluir Cliente"
        description={`Tem certeza que deseja excluir ${deleteCustomerItem?.razao_social || deleteCustomerItem?.nome_fantasia || deleteCustomerItem?.name}? Esta ação não pode ser desfeita.`}
      />
    </div>
  )
}
