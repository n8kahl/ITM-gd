import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminUser } from '@/lib/supabase-server'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * POST /api/admin/academy/generate-lesson
 * Admin only. AI content generation endpoint for creating lesson content.
 * Generates structured lesson content with optional quiz questions.
 *
 * Body: {
 *   course_id: string,
 *   title: string,
 *   topic: string,
 *   difficulty: 'beginner' | 'intermediate' | 'advanced',
 *   lesson_type: 'text' | 'video' | 'interactive' | 'quiz',
 *   generate_quiz: boolean,
 *   num_questions: number (default 5),
 *   additional_context?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - admin access required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      course_id,
      title,
      topic,
      difficulty = 'intermediate',
      lesson_type = 'text',
      generate_quiz = true,
      num_questions = 5,
      additional_context,
    } = body

    if (!course_id || !title || !topic) {
      return NextResponse.json(
        { success: false, error: 'course_id, title, and topic are required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Verify the course exists
    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('id, title, slug')
      .eq('id', course_id)
      .single()

    if (courseError || !course) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      )
    }

    // Get the next display_order for this course
    const { data: lastLesson } = await supabaseAdmin
      .from('lessons')
      .select('display_order')
      .eq('course_id', course_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder = (lastLesson?.display_order || 0) + 1

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    // Build the AI prompt for content generation
    const systemPrompt = `You are an expert trading educator creating content for the TITM Academy.
Generate structured lesson content on the given topic. The content should be:
- Appropriate for ${difficulty} level traders
- Practical with real-world examples
- Well-organized with clear headings and sections
- Include key takeaways at the end

Format the content as markdown.`

    const userPrompt = `Create a comprehensive lesson titled "${title}" about "${topic}" for the ${course.title} course.
Difficulty: ${difficulty}
Lesson type: ${lesson_type}
${additional_context ? `Additional context: ${additional_context}` : ''}

${generate_quiz ? `Also generate ${num_questions} multiple-choice quiz questions about this topic. For each question provide:
- The question text
- 4 answer options (A, B, C, D)
- The correct answer
- A brief explanation of why the answer is correct

Format quiz questions as a JSON array.` : ''}

Return your response as JSON with the following structure:
{
  "content": "markdown lesson content here",
  "summary": "2-3 sentence summary",
  "key_takeaways": ["takeaway 1", "takeaway 2", ...],
  "estimated_minutes": number,
  ${generate_quiz ? '"quiz_questions": [{"question_text": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "correct_answer": "A", "explanation": "..."}]' : ''}
}`

    // Call AI API for content generation
    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'AI API key not configured' },
        { status: 500 }
      )
    }

    let generatedContent: {
      content: string
      summary: string
      key_takeaways: string[]
      estimated_minutes: number
      quiz_questions?: Array<{
        question_text: string
        options: Record<string, string>
        correct_answer: string
        explanation: string
      }>
    }

    // Try Anthropic first, fall back to OpenAI
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
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`)
      }

      const result = await response.json()
      const text = result.content?.[0]?.text || ''
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text]
      generatedContent = JSON.parse(jsonMatch[1]!.trim())
    } else {
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
          max_tokens: 4096,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const result = await response.json()
      generatedContent = JSON.parse(result.choices[0].message.content)
    }

    // Create the lesson in the database
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('lessons')
      .insert({
        course_id,
        title,
        slug,
        description: generatedContent.summary,
        content: generatedContent.content,
        content_format: 'markdown',
        lesson_type,
        estimated_minutes: generatedContent.estimated_minutes || 15,
        display_order: nextOrder,
        is_published: false, // Draft by default
        resources: {
          key_takeaways: generatedContent.key_takeaways,
        },
        ai_generated: true,
      })
      .select()
      .single()

    if (lessonError) {
      return NextResponse.json(
        { success: false, error: lessonError.message },
        { status: 500 }
      )
    }

    // Create quiz questions if generated
    let quizCount = 0
    if (generate_quiz && generatedContent.quiz_questions?.length) {
      const quizInserts = generatedContent.quiz_questions.map((q, idx) => ({
        lesson_id: lesson.id,
        question_text: q.question_text,
        question_type: 'multiple_choice',
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        display_order: idx + 1,
        points: 1,
      }))

      const { error: quizError } = await supabaseAdmin
        .from('quiz_questions')
        .insert(quizInserts)

      if (!quizError) {
        quizCount = quizInserts.length
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        lesson,
        quiz_questions_created: quizCount,
        message: 'Lesson generated successfully. Review and publish when ready.',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
