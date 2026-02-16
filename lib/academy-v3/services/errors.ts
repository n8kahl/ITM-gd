export class AcademyPlanNotFoundError extends Error {
  constructor(message = 'Academy program not found') {
    super(message)
    this.name = 'AcademyPlanNotFoundError'
  }
}

export class AcademyModuleNotFoundError extends Error {
  constructor(message = 'Academy module not found') {
    super(message)
    this.name = 'AcademyModuleNotFoundError'
  }
}

export class AcademyLessonNotFoundError extends Error {
  constructor(message = 'Academy lesson not found') {
    super(message)
    this.name = 'AcademyLessonNotFoundError'
  }
}

export class AcademyBlockNotFoundError extends Error {
  constructor(message = 'Lesson block not found') {
    super(message)
    this.name = 'AcademyBlockNotFoundError'
  }
}

export class AcademyAssessmentNotFoundError extends Error {
  constructor(message = 'Academy assessment not found') {
    super(message)
    this.name = 'AcademyAssessmentNotFoundError'
  }
}

export class AcademyReviewQueueItemNotFoundError extends Error {
  constructor(message = 'Review queue item not found') {
    super(message)
    this.name = 'AcademyReviewQueueItemNotFoundError'
  }
}
