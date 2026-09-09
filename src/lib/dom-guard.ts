/**
 * Utilitário de segurança DOM para evitar crashes causados por extensões do navegador,
 * tradutores automáticos (como Google Translate) ou manipulações externas de nós
 * que conflitam com o reconciliador do React (Virtual DOM).
 *
 * O erro clássico reportado em React 18:
 * "NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node."
 * e
 * "NotFoundError: Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node."
 *
 * Ao instruir o DOM a tolerar nós que já foram reparentados/removidos por extensões ou scripts
 * externos, evitamos a destruição catastrófica da árvore do React.
 */

declare global {
  interface Window {
    __domMutationCrashGuardInstalled?: boolean
  }
}

export function installDomMutationCrashGuard(): void {
  if (typeof window === 'undefined' || typeof Node !== 'function' || !Node.prototype) {
    return
  }

  if (window.__domMutationCrashGuardInstalled) {
    return
  }
  window.__domMutationCrashGuardInstalled = true

  try {
    const originalRemoveChild = Node.prototype.removeChild
    Node.prototype.removeChild = function <T extends Node>(child: T): T {
      // Se o nó a ser removido não é mais filho deste nó (por exemplo, tradutor ou extensão moveu),
      // remove-o de seu nó pai real (se ainda tiver) para satisfazer o objetivo do React sem lançar exceção.
      if (child && child.parentNode !== this) {
        if (child.parentNode) {
          try {
            return originalRemoveChild.call(child.parentNode, child) as T
          } catch {
            return child
          }
        }
        return child
      }
      return originalRemoveChild.call(this, child) as T
    }

    const originalInsertBefore = Node.prototype.insertBefore
    Node.prototype.insertBefore = function <T extends Node>(
      newNode: T,
      referenceNode: Node | null,
    ): T {
      // Se o nó de referência foi reparentado por um tradutor/extensão, insere como appendChild deste container
      // ou remove o conflito para não explodir com NotFoundError.
      if (referenceNode && referenceNode.parentNode !== this) {
        if (referenceNode.parentNode) {
          try {
            return originalInsertBefore.call(referenceNode.parentNode, newNode, referenceNode) as T
          } catch {
            return originalInsertBefore.call(this, newNode, null) as T
          }
        }
        return originalInsertBefore.call(this, newNode, null) as T
      }
      return originalInsertBefore.call(this, newNode, referenceNode) as T
    }
  } catch (err) {
    console.warn('[installDomMutationCrashGuard] Não foi possível instalar guarda de mutação:', err)
  }
}
