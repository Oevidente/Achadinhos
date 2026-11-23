import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { APP_CONFIG } from '../config';
import type { AtualizarProdutoInput, CriarProdutoInput, Produto } from '../types/produto';
import {
  sanitizarAtualizacaoProduto,
  sanitizarCriacaoProduto,
  validarIdDocumento,
} from '../utils/produtoValidation';
import { db, handleFirestoreError, OperationType } from './firebase';

const COLECAO_PRODUTOS = 'produtos';

export interface PaginaProdutosAtivos {
  itens: Produto[];
  ultimoCursor: QueryDocumentSnapshot<DocumentData> | null;
  temMais: boolean;
  indiceCompostoPendente: boolean;
}

function mapearDocumentoProduto(snap: QueryDocumentSnapshot<DocumentData>): Produto {
  const data = snap.data();
  return {
    id: snap.id,
    titulo: String(data.titulo ?? ''),
    descricao: String(data.descricao ?? ''),
    imagemUrl: String(data.imagemUrl ?? ''),
    precoAtual: Number(data.precoAtual ?? 0),
    precoOriginal: data.precoOriginal === null || data.precoOriginal === undefined ? null : Number(data.precoOriginal),
    moeda: String(data.moeda ?? 'BRL'),
    plataforma: data.plataforma ?? 'outra',
    linkOriginal: String(data.linkOriginal ?? ''),
    linkAfiliado: data.linkAfiliado ? String(data.linkAfiliado) : null,
    status: data.status ?? 'ativo',
    origemDados: data.origemDados ?? 'manual',
    destaque: Boolean(data.destaque ?? false),
    cliques: Number(data.cliques ?? 0),
    validoAte:
      typeof data.validoAte === 'string' && data.validoAte.trim()
        ? data.validoAte.trim()
        : null,
    criadoEm: data.criadoEm ?? null,
    atualizadoEm: data.atualizadoEm ?? null,
  };
}

export async function listarProdutos(
  maximo: number = APP_CONFIG.limitePadraoProdutos
): Promise<Produto[]> {
  try {
    const limiteSeguro = Math.max(1, Math.min(100, Math.floor(maximo)));
    const q = query(
      collection(db, COLECAO_PRODUTOS),
      orderBy('criadoEm', 'desc'),
      limit(limiteSeguro)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(mapearDocumentoProduto);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLECAO_PRODUTOS);
  }
}

export async function listarProdutosAtivosPaginado(opcoes?: {
  tamanhoPagina?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
}): Promise<PaginaProdutosAtivos> {
  const tamanho = Math.max(1, Math.min(48, Math.floor(opcoes?.tamanhoPagina ?? 24)));
  const cursor = opcoes?.cursor ?? null;

  const montarPagina = (
    docs: QueryDocumentSnapshot<DocumentData>[],
    filtrarAtivosLocalmente: boolean,
    indiceCompostoPendente: boolean
  ): PaginaProdutosAtivos => {
    const temMais = docs.length > tamanho;
    const fatia = temMais ? docs.slice(0, tamanho) : docs;
    const mapeados = fatia.map(mapearDocumentoProduto);
    const itens = filtrarAtivosLocalmente
      ? mapeados.filter((p) => p.status === 'ativo')
      : mapeados;
    const ultimoCursor = fatia.length > 0 ? fatia[fatia.length - 1] : null;
    return {
      itens,
      ultimoCursor,
      temMais,
      indiceCompostoPendente,
    };
  };

  try {
    const restricoes: QueryConstraint[] = [
      where('status', '==', 'ativo'),
      orderBy('criadoEm', 'desc'),
    ];
    if (cursor) {
      restricoes.push(startAfter(cursor));
    }
    restricoes.push(limit(tamanho + 1));

    const snapshot = await getDocs(query(collection(db, COLECAO_PRODUTOS), ...restricoes));
    return montarPagina(snapshot.docs, false, false);
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : String(error);
    const faltaIndice =
      mensagem.toLowerCase().includes('requires an index') ||
      mensagem.toLowerCase().includes('failed-precondition');

    if (faltaIndice) {
      console.error(
        'Firestore: índice composto necessário em "produtos" (status ASC, criadoEm DESC). Link para criar:',
        mensagem
      );
      try {
        const fallbackRestricoes: QueryConstraint[] = [orderBy('criadoEm', 'desc')];
        if (cursor) {
          fallbackRestricoes.push(startAfter(cursor));
        }
        fallbackRestricoes.push(limit(tamanho + 1));
        const fallbackSnap = await getDocs(
          query(collection(db, COLECAO_PRODUTOS), ...fallbackRestricoes)
        );
        return montarPagina(fallbackSnap.docs, true, true);
      } catch (fallbackError) {
        handleFirestoreError(fallbackError, OperationType.LIST, COLECAO_PRODUTOS);
      }
    }

    handleFirestoreError(error, OperationType.LIST, COLECAO_PRODUTOS);
  }
}

export async function buscarProduto(id: string): Promise<Produto | null> {
  const idValido = validarIdDocumento(id);
  const path = `${COLECAO_PRODUTOS}/${idValido}`;
  try {
    const docRef = doc(db, COLECAO_PRODUTOS, idValido);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return mapearDocumentoProduto(snapshot as QueryDocumentSnapshot<DocumentData>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function criarProduto(dados: CriarProdutoInput): Promise<string> {
  const payload = sanitizarCriacaoProduto(dados);
  try {
    const docRef = await addDoc(collection(db, COLECAO_PRODUTOS), {
      ...payload,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLECAO_PRODUTOS);
  }
}

export async function atualizarProduto(id: string, dados: AtualizarProdutoInput): Promise<void> {
  const idValido = validarIdDocumento(id);
  const patch = sanitizarAtualizacaoProduto(dados);
  if (Object.keys(patch).length === 0) {
    return;
  }
  const path = `${COLECAO_PRODUTOS}/${idValido}`;
  try {
    const docRef = doc(db, COLECAO_PRODUTOS, idValido);
    await updateDoc(docRef, {
      ...patch,
      atualizadoEm: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function registrarCliqueProduto(id: string): Promise<void> {
  try {
    const idValido = validarIdDocumento(id);
    const docRef = doc(db, COLECAO_PRODUTOS, idValido);
    await updateDoc(docRef, {
      cliques: increment(1),
    });
  } catch (error) {
    console.error('Não foi possível registrar clique do produto:', error);
  }
}

export async function atualizarPrecoRevalidado(id: string, novoPreco: number): Promise<void> {
  const idValido = validarIdDocumento(id);
  const precoSanitizado = Number(novoPreco);
  if (!Number.isFinite(precoSanitizado) || precoSanitizado <= 0) {
    throw new Error('O novo preço informado para atualização é inválido.');
  }
  const path = `${COLECAO_PRODUTOS}/${idValido}`;
  try {
    const docRef = doc(db, COLECAO_PRODUTOS, idValido);
    await updateDoc(docRef, {
      precoAtual: precoSanitizado,
      atualizadoEm: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function excluirProduto(id: string): Promise<void> {
  const idValido = validarIdDocumento(id);
  const path = `${COLECAO_PRODUTOS}/${idValido}`;
  try {
    await deleteDoc(doc(db, COLECAO_PRODUTOS, idValido));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
