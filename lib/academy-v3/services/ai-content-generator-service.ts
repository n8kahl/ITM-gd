import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  AcademyDifficulty,
  AiGeneratedBlock,
  AiGeneratedLesson,
} from '@/lib/academy-v3/contracts/domain'

export class AiContentGeneratorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiContentGeneratorError'
  }
}

interface GenerateInput {
  topic: string
  difficulty: AcademyDifficulty
  estimatedMinutes: number
  keyTopics?: string[]
  moduleTitle?: string
}

interface PersistInput {
  moduleId: string
  userId: string
  lesson: AiGeneratedLesson
}

interface PersistedLesson {
  lessonId: string
  title: string
  slug: string
  blockCount: number
}

export class AiContentGeneratorService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Generate a full lesson with structured blocks, quiz, and key takeaways.
   * Returns structured data — does NOT persist to DB.
   */
  async generateLesson(input: GenerateInput): Promise<AiGeneratedLesson> {
    const systemPrompt = `You are an expert options trading educator creating structured academy lessons.
Return valid JSON matching this exact schema:
{
  "title": "string",
  "learningObjective": "string",
  "estimatedMinutes": number,
  "difficulty": "beginner" | "intermediate" | "advanced",
  "blocks": [
    {
      "blockType": "hook" | "concept_explanation" | "worked_example" | "guided_practice" | "independent_practice" | "reflection",
      "title": "string",
      "contentJson": { "markdown": "full markdown content for this block" }
    }
  ],
  "keyTakeaways": ["string"],
  "quizQuestions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": 0,
      "explanation": "string"
    }
  ]
}

Rules:
- Always include exactly 6 blocks in this order: hook, concept_explanation, worked_example, guided_practice, independent_practice, reflection
- Generate 3-5 quiz questions
- Generate 3-5 key takeaways
- Content must be specific to options trading education
- Markdown in contentJson should be detailed and educational`

    const topicLine = input.keyTopics && input.keyTopics.length > 0
      ? `Key topics: ${input.keyTopics.join(', ')}`
      : `Topic: ${input.topic}`

    const contextLine = input.moduleTitle
      ? `Module context: ${input.moduleTitle}`
      : ''

    const userPrompt = `Generate a structured lesson:
${contextLine}
${topicLine}
Difficulty: ${input.difficulty}
Target length: ${input.estimatedMinutes} minutes

Return ONLY valid JSON.`

    const rawContent = await this.callAiApi(systemPrompt, userPrompt)
    return this.parseAndValidateResponse(rawContent, input)
  }

  /**
   * Persist a generated lesson to the database with structured blocks.
   * Creates the lesson in 'draft' status.
   */
  async persistLesson(input: PersistInput): Promise<PersistedLesson> {
    const slug = this.slugify(input.lesson.title) + '-' + Date.now().toString(36)

    // Get next position in module
    const { data: lastLesson } = await this.supabase
      .from('academy_lessons')
      .select('position')
      .eq('module_id', input.moduleId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextPosition = ((lastLesson?.position as number) ?? 0) + 1

    const { data: lesson, error: lessonError } = await this.supabase
      .from('academy_lessons')
      .insert({
        module_id: input.moduleId,
        title: input.lesson.title,
        slug,
        learning_objective: input.lesson.learningObjective,
        estimated_minutes: input.lesson.estimatedMinutes,
        difficulty: input.lesson.difficulty,
        position: nextPosition,
        is_published: false,
        status: 'draft',
        metadata: {
          source: 'ai_content_generator_v2',
          key_takeaways: input.lesson.keyTakeaways,
          quiz_data: this.buildQuizData(input.lesson.quizQuestions),
        },
      })
      .select('id, title, slug')
      .single()

    if (lessonError || !lesson) {
      throw new AiContentGeneratorError(`Failed to create lesson: ${lessonError?.message ?? 'unknown'}`)
    }

    const lessonId = lesson.id as string

    // Insert structured blocks
    if (input.lesson.blocks.length > 0) {
      const blockRows = input.lesson.blocks.map((block: AiGeneratedBlock, index: number) => ({
        lesson_id: lessonId,
        block_type: block.blockType,
        position: index,
        title: block.title,
        content_json: {
          ...block.contentJson,
          source: 'ai_content_generator_v2',
        },
      }))

      const { error: blockError } = await this.supabase
        .from('academy_lesson_blocks')
        .insert(blockRows)

      if (blockError) {
        throw new AiContentGeneratorError(`Failed to create blocks: ${blockError.message}`)
      }
    }

    return {
      lessonId,
      title: lesson.title as string,
      slug: lesson.slug as string,
      blockCount: input.lesson.blocks.length,
    }
  }

  private async callAiApi(systemPrompt: string, userPrompt: string): Promise<string> {
    if (process.env.ANTHROPIC_API_KEY) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })

      if (!response.ok) {
        throw new AiContentGeneratorError(`Anthropic API error: ${response.status}`)
      }

      const result = await response.json()
      return result.content?.[0]?.text ?? ''
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new AiContentGeneratorError('No AI API key configured (ANTHROPIC_API_KEY or OPENAI_API_KEY)')
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 8192,
      }),
    })

    if (!response.ok) {
      throw new AiContentGeneratorError(`OpenAI API error: ${response.status}`)
    }

    const result = await response.json()
    return result.choices?.[0]?.message?.content ?? ''
  }

  private parseAndValidateResponse(rawText: string, input: GenerateInput): AiGeneratedLesson {
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1]!.trim() : rawText.trim()

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(jsonStr) as Record<string, unknown>
    } catch {
      throw new AiContentGeneratorError('Failed to parse AI response as JSON')
    }

    // Normalize blocks
    const rawBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : []
    const blocks = rawBlocks
      .filter((b): b is Record<string, unknown> => typeof b === 'object' && b !== null)
      .map((b) => ({
        blockType: this.normalizeBlockType(String(b.blockType ?? b.block_type ?? 'concept_explanation')),
        title: String(b.title ?? ''),
        contentJson: (typeof b.contentJson === 'object' && b.contentJson !== null
          ? b.contentJson
          : typeof b.content_json === 'object' && b.content_json !== null
            ? b.content_json
            : { markdown: String(b.content ?? b.markdown ?? '') }) as Record<string, unknown>,
      }))

    // Normalize quiz questions
    const rawQuiz = Array.isArray(parsed.quizQuestions ?? parsed.quiz_questions)
      ? (parsed.quizQuestions ?? parsed.quiz_questions) as Record<string, unknown>[]
      : []
    const quizQuestions = rawQuiz
      .filter((q): q is Record<string, unknown> => typeof q === 'object' && q !== null)
      .map((q) => ({
        question: String(q.question ?? ''),
        options: Array.isArray(q.options) ? q.options.map(String).slice(0, 4) : [],
        correctAnswer: Number.isFinite(q.correctAnswer ?? q.correct_answer)
          ? Number(q.correctAnswer ?? q.correct_answer)
          : 0,
        explanation: String(q.explanation ?? ''),
      }))
      .filter((q) => q.question.length > 0 && q.options.length >= 2)

    const keyTakeaways = Array.isArray(parsed.keyTakeaways ?? parsed.key_takeaways)
      ? ((parsed.keyTakeaways ?? parsed.key_takeaways) as unknown[]).map(String).filter(Boolean)
      : []

    return {
      title: String(parsed.title ?? input.topic),
      learningObjective: String(parsed.learningObjective ?? parsed.learning_objective ?? input.topic),
      estimatedMinutes: Number.isFinite(parsed.estimatedMinutes ?? parsed.estimated_minutes)
        ? Math.max(5, Math.round(Number(parsed.estimatedMinutes ?? parsed.estimated_minutes)))
        : input.estimatedMinutes,
      difficulty: input.difficulty,
      blocks,
      keyTakeaways,
      quizQuestions,
    }
  }

  private normalizeBlockType(raw: string): AiGeneratedLesson['blocks'][number]['blockType'] {
    const valid = [
      'hook', 'concept_explanation', 'worked_example',
      'guided_practice', 'independent_practice', 'reflection',
    ]
    return valid.includes(raw)
      ? raw as AiGeneratedLesson['blocks'][number]['blockType']
      : 'concept_explanation'
  }

  private buildQuizData(questions: AiGeneratedLesson['quizQuestions']) {
    return {
      questions: questions.map((q: AiGeneratedLesson['quizQuestions'][number], index: number) => {
        const options = q.options.map((opt: string, optIndex: number) => ({
          id: String.fromCharCode(97 + optIndex),
          text: opt,
        }))
        const correctIndex = Math.max(0, Math.min(options.length - 1, q.correctAnswer))
        return {
          id: `q${index + 1}`,
          type: 'multiple_choice',
          text: q.question,
          options,
          correct_answer: options[correctIndex]?.id ?? 'a',
          explanation: q.explanation,
        }
      }),
      passing_score: 70,
    }
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }
}
