import {
  CATEGORIAS_PRODUTO,
  type CategoriaProduto,
  type Produto,
} from '../types/produto';

export interface CategoriaConfig {
  id: CategoriaProduto;
  nome: string;
  nomeCurto: string;
}

export const CATEGORIAS_CONFIG: Record<CategoriaProduto, CategoriaConfig> = {
  tech_gamer: {
    id: 'tech_gamer',
    nome: 'Tech & Gamer',
    nomeCurto: 'Tech & Gamer',
  },
  celulares_audio: {
    id: 'celulares_audio',
    nome: 'Celulares & Áudio',
    nomeCurto: 'Celulares',
  },
  casa_cozinha: {
    id: 'casa_cozinha',
    nome: 'Casa & Cozinha',
    nomeCurto: 'Casa',
  },
  moda_beleza: {
    id: 'moda_beleza',
    nome: 'Moda & Beleza',
    nomeCurto: 'Moda',
  },
  esporte_lazer: {
    id: 'esporte_lazer',
    nome: 'Esporte & Lazer',
    nomeCurto: 'Esporte',
  },
  ferramentas_auto: {
    id: 'ferramentas_auto',
    nome: 'Ferramentas & Auto',
    nomeCurto: 'Ferramentas',
  },
  presentes_variedades: {
    id: 'presentes_variedades',
    nome: 'Presentes & Utilidades',
    nomeCurto: 'Presentes',
  },
  outros: {
    id: 'outros',
    nome: 'Outros',
    nomeCurto: 'Outros',
  },
};

export function normalizarCategoria(valor?: unknown): CategoriaProduto | null {
  if (valor === null || valor === undefined) return null;
  const limpa = String(valor).trim();
  if (!limpa) return null;
  if (CATEGORIAS_PRODUTO.includes(limpa as CategoriaProduto)) {
    return limpa as CategoriaProduto;
  }
  return null;
}

export function obterNomeCategoria(
  categoria?: CategoriaProduto | null
): string {
  if (!categoria) return '';
  return CATEGORIAS_CONFIG[categoria]?.nome ?? '';
}

const REGRAS_SUGESTAO: Array<{
  categoria: CategoriaProduto;
  termos: string[];
}> = [
  {
    categoria: 'celulares_audio',
    termos: [
      'iphone',
      'samsung galaxy',
      'xiaomi',
      'redmi',
      'poco ',
      'motorola',
      'smartphone',
      'celular',
      'fone',
      'headphone',
      'headset',
      'earbuds',
      'airpods',
      'jbl',
      'caixa de som',
      'soundbar',
      'smartwatch',
      'carregador',
      'power bank',
      'powerbank',
      'cabo usb',
      'capinha',
      'pelicula',
    ],
  },
  {
    categoria: 'tech_gamer',
    termos: [
      'playstation',
      'ps5',
      'ps4',
      'xbox',
      'nintendo',
      'switch',
      'dualsense',
      'joystick',
      'controle',
      'gamer',
      'setup',
      'teclado',
      'mouse',
      'mousepad',
      'monitor',
      'notebook',
      'laptop',
      'ssd',
      'placa de video',
      'rtx',
      'processador',
      'ryzen',
      'smart tv',
      'televisao',
      'tv ',
      'led usb',
      'rgb',
      'webcam',
      'microfone',
      'roteador',
      'kindle',
      'tablet',
      'ipad',
      'impressora',
    ],
  },
  {
    categoria: 'casa_cozinha',
    termos: [
      'air fryer',
      'airfryer',
      'fritadeira',
      'cafeteira',
      'liquidificador',
      'panela',
      'aspirador',
      'robo aspirador',
      'geladeira',
      'microondas',
      'micro-ondas',
      'lavadora',
      'ventilador',
      'ar condicionado',
      'luminaria',
      'abajur',
      'tapete',
      'travesseiro',
      'lencol',
      'toalha',
      'organizador',
      'prateleira',
      'mesa ',
      'cadeira',
      'cozinha',
      'banheiro',
      'quarto',
      'garrafa termica',
      'copo stanley',
    ],
  },
  {
    categoria: 'moda_beleza',
    termos: [
      'tenis',
      'sapato',
      'sandalia',
      'chinelo',
      'camiseta',
      'camisa',
      'jaqueta',
      'moletom',
      'calca',
      'vestido',
      'relogio',
      'bolsa',
      'mochila',
      'oculos',
      'perfume',
      'hidratante',
      'protetor solar',
      'serum',
      'shampoo',
      'maquiagem',
      'batom',
      'secador',
      'chapinha',
      'barbeador',
    ],
  },
  {
    categoria: 'esporte_lazer',
    termos: [
      'whey',
      'creatina',
      'suplemento',
      'academia',
      'haltere',
      'bicicleta',
      'bike',
      'capacete',
      'barraca',
      'camping',
      'pesca',
      'futebol',
      'chuteira',
      'yoga',
      'esteira',
      'patinete',
    ],
  },
  {
    categoria: 'ferramentas_auto',
    termos: [
      'furadeira',
      'parafusadeira',
      'esmerilhadeira',
      'serra',
      'chave de fenda',
      'maleta de ferramentas',
      'multimetro',
      'pneu',
      'carro',
      'moto',
      'automotivo',
      'calibrador',
      'lavadora de alta pressao',
      'wap',
    ],
  },
  {
    categoria: 'presentes_variedades',
    termos: [
      'presente',
      'caneca',
      'lego',
      'brinquedo',
      'pelucia',
      'funko',
      'papelaria',
      'caderno',
      'caneta',
      'livro',
      'jogo de tabuleiro',
      'decoracao',
      'colecionavel',
      'pet',
      'cachorro',
      'gato',
    ],
  },
];

function removerAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function sugerirCategoriaProduto(
  titulo: string,
  descricao = ''
): CategoriaProduto | null {
  const base = removerAcentos(`${titulo} ${descricao}`).trim();
  if (!base) return null;

  for (const regra of REGRAS_SUGESTAO) {
    if (regra.termos.some((termo) => base.includes(termo))) {
      return regra.categoria;
    }
  }
  return null;
}

export function obterCategoriaEfetiva(
  produto: Pick<Produto, 'categoria' | 'titulo' | 'descricao'>
): CategoriaProduto | null {
  if (produto.categoria) return produto.categoria;
  return sugerirCategoriaProduto(produto.titulo, produto.descricao);
}
