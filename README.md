# 🎓 세특 작성 전문가 — 입학사정관 관점 AI

> **고등학교 교사를 위한 AI 기반 세특(세부능력 및 특기사항) 초안 작성 도구**  
> Gemini AI가 입학사정관의 관점에서 고품질 세특을 작성해 드립니다.

---

## ✨ 주요 기능

| 기능 | 설명 |
|---|---|
| 📄 **파일 업로드** | PDF, TXT, MD 파일에서 학생 자료 자동 추출 |
| 🤖 **AI 초안 생성** | Gemini 2.0 Flash 기반의 입학사정관 관점 세특 작성 |
| ✏️ **피드백 반영** | 수정 요청을 채팅으로 입력하면 즉시 반영 |
| 📏 **분량 제어** | 목표 바이트(500~1500b)에 맞게 정밀 조정 |
| 📋 **클립보드 복사** | 완성된 세특을 NEIS에 바로 붙여넣기 가능 |

---

## 🚀 로컬 실행 방법

### 사전 요구사항
- [Node.js](https://nodejs.org/) v18 이상

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone https://github.com/YOUR_USERNAME/setech-writer-ai.git
cd setech-writer-ai

# 2. 패키지 설치
npm install

# 3. 환경변수 설정
cp .env.example .env.local
# .env.local 파일을 열어 GEMINI_API_KEY 값을 입력하세요

# 4. 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

---

## 🔑 Gemini API 키 발급 방법

1. [Google AI Studio](https://aistudio.google.com/) 접속
2. 우측 상단 **"Get API Key"** 클릭
3. **"Create API Key"** 선택 후 키 복사
4. `.env.local` 파일에 붙여넣기:
   ```
   GEMINI_API_KEY=여기에_발급받은_키_입력
   ```

> ⚠️ API 키는 절대 GitHub에 올리지 마세요. `.gitignore`에 `.env.local`이 포함되어 있습니다.

---

## 🏗️ 프로젝트 구조

```
setech-writer-ai/
├── src/
│   ├── App.tsx              # 메인 애플리케이션 컴포넌트
│   ├── types.ts             # TypeScript 타입 정의
│   ├── main.tsx             # React 진입점
│   ├── index.css            # 전역 스타일
│   ├── services/
│   │   └── gemini.ts        # Gemini API 호출 로직 및 시스템 프롬프트
│   └── lib/
│       └── utils.ts         # 유틸리티 함수 (cn)
├── index.html               # HTML 진입점
├── vite.config.ts           # Vite 설정
├── tsconfig.json            # TypeScript 설정
├── package.json
├── .env.example             # 환경변수 예시 (API 키 없음)
└── .gitignore
```

---

## 🤖 AI 작성 원칙 (시스템 프롬프트 핵심)

이 앱의 AI는 다음 기준으로 세특을 작성합니다:

- **학종의 CODE** 4가지 역량 반영: `지식탐구` · `진로준비` · `공동체의식` · `문제극복`
- **교사 관찰 시점** 서술: `~함`, `~임`, `~라는 평가를 받음`
- **구조화된 흐름**: 탐구 동기 → 수행 과정 → 결과 → 역량 성장
- **전문 어휘 활용**: 도출하다, 재구조화하다, 탁월한, 심층적인 등
- **NEIS 최적화**: 줄 바꿈 없는 단일 문단 출력

---

## 🛠️ 기술 스택

- **Frontend**: React 19 + TypeScript + Vite
- **AI**: Google Gemini 2.0 Flash (`@google/genai`)
- **Styling**: Tailwind CSS v4
- **애니메이션**: Motion (Framer Motion)
- **PDF 파싱**: pdfjs-dist
- **아이콘**: Lucide React

---

## 📝 사용 방법

1. **과목명** 및 **목표 분량(바이트)** 입력
2. **학생 활동 자료** — PDF/텍스트 파일 업로드 또는 직접 입력
3. **교사 관찰 내용** 입력 (필수)
4. **후속활동 내용** 입력 (선택)
5. **"세특 초안 생성하기"** 클릭
6. 초안 검토 후 수정 요청 입력 → 반복 수정
7. **"최종 확정하기"** → 클립보드 복사 → NEIS 붙여넣기

---

## 📄 라이선스

Apache License 2.0

---

## 👨‍🏫 제작

숭신고등학교 진로진학상담부  
[Google AI Studio](https://aistudio.google.com/)에서 최초 개발
