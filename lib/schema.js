export const DEPARTMENTS = [
  "Computer Science",
  "Information Technology",
  "Electronics",
  "Electrical",
  "Mechanical",
  "Civil",
  "Commerce",
  "Mathematics",
  "Physics",
  "Humanities"
];

export const ACADEMIC_YEARS = ["2024-25", "2025-26", "2026-27"];

export const RATING_FIELDS = [
  { key: "teaching", label: "Teaching quality" },
  { key: "content", label: "Course content" },
  { key: "assessment", label: "Assessment and feedback" },
  { key: "facilities", label: "Labs and library" },
  { key: "infrastructure", label: "Classrooms and campus" }
];

const LIMITS = {
  name: 80,
  roll: 20,
  course: 120,
  faculty: 80,
  comments: 2000,
  suggestions: 2000
};

function text(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export function validateFeedback(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Submit the feedback form as JSON." };
  }

  const anonymous = Boolean(body.anonymous);
  const name = anonymous ? "" : text(body.name, LIMITS.name);
  const roll = anonymous ? "" : text(body.roll, LIMITS.roll).toUpperCase();
  const department = text(body.department, 60);
  const course = text(body.course, LIMITS.course);
  const faculty = text(body.faculty, LIMITS.faculty);
  const academicYear = text(body.academicYear, 12);
  const comments = text(body.comments, LIMITS.comments);
  const suggestions = text(body.suggestions, LIMITS.suggestions);
  const semester = Number(body.semester);

  if (!anonymous && name.length < 2) {
    return { error: "Enter the student name, or submit anonymously." };
  }
  if (!anonymous && !/^[A-Z0-9/-]{2,20}$/.test(roll)) {
    return { error: "Enter a roll number using letters, numbers, or hyphens." };
  }
  if (!DEPARTMENTS.includes(department)) {
    return { error: "Choose a department from the list." };
  }
  if (!Number.isInteger(semester) || semester < 1 || semester > 8) {
    return { error: "Choose a semester from 1 to 8." };
  }
  if (course.length < 2) {
    return { error: "Enter the course or subject name." };
  }
  if (!ACADEMIC_YEARS.includes(academicYear)) {
    return { error: "Choose an academic year." };
  }
  if (comments.length < 10) {
    return { error: "Write at least a short comment (10 characters)." };
  }

  const ratings = {};
  for (const field of RATING_FIELDS) {
    const score = Number(body.ratings?.[field.key]);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return { error: `Rate ${field.label.toLowerCase()} from 1 to 5.` };
    }
    ratings[field.key] = score;
  }

  const mean = RATING_FIELDS.reduce((sum, field) => sum + ratings[field.key], 0) / RATING_FIELDS.length;

  return {
    value: {
      anonymous,
      name: anonymous ? "Anonymous" : name,
      roll,
      department,
      semester,
      course,
      faculty,
      academicYear,
      ratings,
      average: Math.round(mean * 10) / 10,
      comments,
      suggestions
    }
  };
}
