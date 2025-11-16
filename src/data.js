/* global window */

(function attachThaiLearningData(global) {
  const categories = [
  { id: 'consonant', label: '子音', color: '#fcd34d' },
  { id: 'vowel', label: '母音', color: '#f472b6' },
  { id: 'tone', label: '音調', color: '#60a5fa' },
  { id: 'word', label: '單字', color: '#34d399' }
  ];

  const learningItems = [
  {
    id: 'k_kai',
    thai: 'ก',
    transliteration: 'k / g',
    englishHint: 'unaspirated k like “go”',
    mnemonic: '字體像側面的小雞，想到呱呱雞就記得這個字形。',
    visual: '🐔',
    category: 'consonant',
    mnemonicQuestion: {
      prompt: 'ก 的形狀最像哪一個動物？',
      options: ['雞', '魚', '蝸牛'],
      answer: '雞'
    },
    speechText: 'กอ ไก่',
    masteryGoal: 5
  },
  {
    id: 'kh_khuy',
    thai: 'ค',
    transliteration: 'kh',
    englishHint: '強氣 kh, like “khaki”',
    mnemonic: '像張開嘴巴的怪獸，張嘴吸氣準備噴火。',
    visual: '🐲',
    category: 'consonant',
    mnemonicQuestion: {
      prompt: '哪個畫面最像 ค ？',
      options: ['怪獸', '月亮', '椅子'],
      answer: '怪獸'
    },
    speechText: 'คอ ควาย',
    masteryGoal: 5
  },
  {
    id: 'ch_chang',
    thai: 'ช',
    transliteration: 'ch',
    englishHint: '像英文 chair 的 ch',
    mnemonic: '筆畫像小象長鼻，想像大象伸長鼻子。',
    visual: '🐘',
    category: 'consonant',
    mnemonicQuestion: {
      prompt: 'ช 讓你想到？',
      options: ['大象', '香蕉', '雨傘'],
      answer: '大象'
    },
    speechText: 'ชอ ช้าง',
    masteryGoal: 5
  },
  {
    id: 's_sua',
    thai: 'ส',
    transliteration: 's',
    englishHint: '清晰的 s，像英文 see',
    mnemonic: '像蜿蜒的蛇，腦中浮現一條蜷曲的蛇。',
    visual: '🐍',
    category: 'consonant',
    mnemonicQuestion: {
      prompt: 'ส 看起來像哪個動物？',
      options: ['蛇', '貓', '狗'],
      answer: '蛇'
    },
    speechText: 'สอ เสือ',
    masteryGoal: 5
  },
  {
    id: 'a_short',
    thai: 'ะ',
    transliteration: 'a (短)',
    englishHint: '短促的 a，像英文 up',
    mnemonic: '像一個張開的小嘴巴，畫面停在那張嘴上。',
    visual: '👶',
    category: 'vowel',
    mnemonicQuestion: {
      prompt: '誰張開小嘴巴？',
      options: ['嬰兒', '海豚', '老虎'],
      answer: '嬰兒'
    },
    speechText: 'อะ',
    masteryGoal: 5
  },
  {
    id: 'aa_long',
    thai: 'า',
    transliteration: 'aa (長)',
    englishHint: '長母音 aa，像英文 father 的 a',
    mnemonic: '像拉長的橡皮筋，線條被拉得長長的。',
    visual: '🪢',
    category: 'vowel',
    mnemonicQuestion: {
      prompt: '什麼東西被拉得長長的？',
      options: ['橡皮筋', '蘋果', '石頭'],
      answer: '橡皮筋'
    },
    speechText: 'อา',
    masteryGoal: 5
  },
  {
    id: 'ai',
    thai: 'ไ/ใ',
    transliteration: 'ai',
    englishHint: '像英文 hi 的 ai',
    mnemonic: '兩條線像兩支拐杖，好像老人扶著站立。',
    visual: '🦯',
    category: 'vowel',
    mnemonicQuestion: {
      prompt: '兩支拐杖讓你想到誰？',
      options: ['老人', '年輕人', '熊'],
      answer: '老人'
    },
    speechText: 'ไอ',
    masteryGoal: 5
  },
  {
    id: 'tone_mid',
    thai: '平調',
    transliteration: 'mid tone',
    englishHint: '聲音平穩，不升不降',
    mnemonic: '像在平坦道路散步，地面筆直。',
    visual: '🚶',
    category: 'tone',
    mnemonicQuestion: {
      prompt: '平調像走在什麼樣的路？',
      options: ['平坦的路', '山坡', '樓梯'],
      answer: '平坦的路'
    },
    speechText: 'เสียงสามัญ',
    masteryGoal: 4
  },
  {
    id: 'tone_rising',
    thai: '升調',
    transliteration: 'rising tone',
    englishHint: '像疑問語氣，尾音上揚',
    mnemonic: '好像坐電梯上樓，線條一路上升。',
    visual: '🛗',
    category: 'tone',
    mnemonicQuestion: {
      prompt: '升調像搭什麼？',
      options: ['電梯', '溜滑梯', '船'],
      answer: '電梯'
    },
    speechText: 'เสียงจัตวา',
    masteryGoal: 4
  },
  {
    id: 'tone_falling',
    thai: '降調',
    transliteration: 'falling tone',
    englishHint: '先高後低，像感嘆「哎呀」',
    mnemonic: '像人在溜滑梯，一路滑到低處。',
    visual: '🛝',
    category: 'tone',
    mnemonicQuestion: {
      prompt: '降調像在玩什麼？',
      options: ['溜滑梯', '盪鞦韆', '飛機'],
      answer: '溜滑梯'
    },
    speechText: 'เสียงโท',
    masteryGoal: 4
  },
  {
    id: 'word_hello',
    thai: 'สวัสดี',
    transliteration: 'sa-wat-dee',
    englishHint: '泰語你好',
    mnemonic: '想像雙手合十向人鞠躬，記住這個畫面。',
    visual: '🙏',
    category: 'word',
    mnemonicQuestion: {
      prompt: '泰國見面會做什麼禮節？',
      options: ['合十', '握拳', '敬禮'],
      answer: '合十'
    },
    speechText: 'สวัสดี',
    masteryGoal: 6,
    breakdown: ['s_sua', 'a_short', 'tone_mid', 'word_hi_suffix']
  },
  {
    id: 'word_how_are_you',
    thai: 'สบายดีไหม',
    transliteration: 'sa-baai-dee-mai?',
    englishHint: '你最近好嗎？',
    mnemonic: '想像朋友掛念你，笑著關心你的表情。',
    visual: '😊',
    category: 'word',
    mnemonicQuestion: {
      prompt: '說「你好嗎」時會有的表情？',
      options: ['關心的笑臉', '生氣臉', '睡覺臉'],
      answer: '關心的笑臉'
    },
    speechText: 'สบายดีไหม',
    masteryGoal: 6,
    breakdown: ['s_sua', 'aa_long', 'tone_rising']
  },
  {
    id: 'word_ruu_mai',
    thai: 'รู้ไหม',
    transliteration: 'ruu mai?',
    englishHint: '你知道嗎？',
    mnemonic: '想像朋友推眼鏡問「你知道嗎？」',
    visual: '🤔',
    category: 'word',
    mnemonicQuestion: {
      prompt: '問句「你知道嗎」的語氣？',
      options: ['好奇', '嚴肅', '害怕'],
      answer: '好奇'
    },
    speechText: 'รู้ไหม',
    masteryGoal: 6,
    breakdown: ['r_rau', 'uu_long', 'tone_rising']
  },
  {
    id: 'r_rau',
    thai: 'ร',
    transliteration: 'r',
    englishHint: '微捲舌或齒邊音 r',
    mnemonic: '像小魚鰭，彎彎的鰭片浮出水面。',
    visual: '🐟',
    category: 'consonant',
    mnemonicQuestion: {
      prompt: 'ร 像什麼？',
      options: ['魚鰭', '刀', '橋'],
      answer: '魚鰭'
    },
    speechText: 'รอ เรือ',
    masteryGoal: 5
  },
  {
    id: 'uu_long',
    thai: 'ู',
    transliteration: 'uu',
    englishHint: '嘴唇前噘的長 u',
    mnemonic: '像兩個氣泡浮上水面黏在一起。',
    visual: '🫧',
    category: 'vowel',
    mnemonicQuestion: {
      prompt: '兩個氣泡排成的形狀最像什麼？',
      options: ['氣泡串', '石頭', '鉛筆'],
      answer: '氣泡串'
    },
    speechText: 'อู',
    masteryGoal: 5
  },
  {
    id: 'word_hi_suffix',
    thai: 'ดี',
    transliteration: 'dee',
    englishHint: '好/美好',
    mnemonic: '想到雙手比讚，保持這個姿勢。',
    visual: '👍',
    category: 'word',
    mnemonicQuestion: {
      prompt: '這個字讓你想到什麼手勢？',
      options: ['比讚', '揮拳', '打哈欠'],
      answer: '比讚'
    },
    speechText: 'ดี',
    masteryGoal: 5,
    breakdown: ['d_dek', 'ii_long']
  },
  {
    id: 'd_dek',
    thai: 'ด',
    transliteration: 'd',
    englishHint: '像英文 dog 的 d',
    mnemonic: '像鼓槌在敲鼓「咚」',
    visual: '🥁',
    category: 'consonant',
    mnemonicQuestion: {
      prompt: 'ด 像什麼物品？',
      options: ['鼓槌', '雨滴', '筷子'],
      answer: '鼓槌'
    },
    speechText: 'ดอ เด็ก',
    masteryGoal: 5
  },
  {
    id: 'ii_long',
    thai: 'ี',
    transliteration: 'ii',
    englishHint: '長 i，像英文 see',
    mnemonic: '像拉直的雷射光，細長的線條。',
    visual: '🔦',
    category: 'vowel',
    mnemonicQuestion: {
      prompt: '哪個選項最細長？',
      options: ['雷射光', '石頭', '方塊'],
      answer: '雷射光'
    },
    speechText: 'อี',
    masteryGoal: 5
  }
  ];

  const itemMap = learningItems.reduce((map, item) => {
    map[item.id] = item;
    return map;
  }, {});

  global.ThaiLearningData = {
    categories,
    learningItems,
    itemMap
  };
})(typeof window !== 'undefined' ? window : globalThis);
