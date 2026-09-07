export const ieltsEvaluationJsonSchema = {
  type: "object",
  description:
    "Official IELTS Speaking evaluation result with scores, detailed criterion analysis, and per-question feedback.",
  properties: {
    overall_band: {
      type: "number",
      description:
        "Overall band score calculated as (FC + LR + GRA + PR) / 4 and rounded using official IELTS rules (0.0 - 9.0 in half-band increments).",
    },
    estimated_band_reason: {
      type: "string",
      description:
        "Detailed rationale explaining why this overall band score was awarded based on official IELTS criteria and audio observations.",
    },
    fluency_coherence: {
      type: "number",
      description:
        "Fluency & Coherence score (0.0 - 9.0 in half-band increments).",
    },
    lexical_resource: {
      type: "number",
      description:
        "Lexical Resource score (0.0 - 9.0 in half-band increments).",
    },
    grammatical_range_accuracy: {
      type: "number",
      description:
        "Grammatical Range & Accuracy score (0.0 - 9.0 in half-band increments).",
    },
    pronunciation: {
      type: "number",
      description: "Pronunciation score (0.0 - 9.0 in half-band increments).",
    },
    overall_feedback: {
      type: "string",
      description:
        "Summary assessment of candidate's overall speaking performance across all parts.",
    },
    criterion_feedback: {
      type: "object",
      description:
        "Detailed qualitative assessment for each of the four IELTS criteria.",
      properties: {
        fluency: {
          type: "string",
          description:
            "Detailed fluency feedback based on speaking rhythm, pauses, and speech flow.",
        },
        vocabulary: {
          type: "string",
          description:
            "Detailed vocabulary feedback on precision, collocations, and idiomatic use.",
        },
        grammar: {
          type: "string",
          description:
            "Detailed grammar feedback on sentence structure variety, tense consistency, and error density.",
        },
        pronunciation: {
          type: "string",
          description:
            "Detailed pronunciation feedback based on acoustic clarity, stress, and intonation.",
        },
      },
      required: ["fluency", "vocabulary", "grammar", "pronunciation"],
    },
    criterion_key_observations: {
      type: "object",
      description:
        "Bullet-point key observations for each IELTS assessment criterion.",
      properties: {
        fluency: {
          type: "array",
          items: { type: "string" },
          description: "Key observations on fluency and speech flow.",
        },
        vocabulary: {
          type: "array",
          items: { type: "string" },
          description: "Key observations on lexical resource.",
        },
        grammar: {
          type: "array",
          items: { type: "string" },
          description: "Key observations on grammatical range and accuracy.",
        },
        pronunciation: {
          type: "array",
          items: { type: "string" },
          description:
            "Key observations on acoustic clarity, stress, and phonology.",
        },
      },
      required: ["fluency", "vocabulary", "grammar", "pronunciation"],
    },
    filler_words: {
      type: "array",
      description:
        "List of detected filler words and their impact on speech flow.",
      items: {
        type: "object",
        properties: {
          word: {
            type: "string",
            description:
              "The filler word, e.g., 'like', 'um', 'uh', 'you know'.",
          },
          count: {
            type: "integer",
            description: "Number of occurrences.",
          },
          impact: {
            type: "string",
            enum: ["low", "moderate", "high"],
            description: "Impact on fluency: 'low', 'moderate', or 'high'.",
          },
        },
        required: ["word", "count", "impact"],
      },
    },
    vocab_upgrades: {
      type: "array",
      description:
        "Suggestions to upgrade basic vocabulary used by the candidate to Band 7.5+ collocations/idioms.",
      items: {
        type: "object",
        properties: {
          original: {
            type: "string",
            description: "Original word or phrase used by the candidate.",
          },
          upgrade: {
            type: "string",
            description: "Higher-band alternative or idiomatic collocation.",
          },
          context_example: {
            type: "string",
            description:
              "Example sentence showing how to use the upgraded vocabulary in context.",
          },
        },
        required: ["original", "upgrade", "context_example"],
      },
    },
    strengths: {
      type: "array",
      items: { type: "string" },
      description: "Key candidate strengths observed during the test.",
    },
    weaknesses: {
      type: "array",
      items: { type: "string" },
      description: "Specific areas where the candidate needs improvement.",
    },
    per_question_items: {
      type: "array",
      description:
        "Detailed per-question breakdown including accurate transcript and feedback.",
      items: {
        type: "object",
        properties: {
          question_id: {
            type: "string",
            description: "Unique question ID matching the prompt.",
          },
          live_stt_transcript: {
            type: "string",
            description: "Raw browser STT snippet provided.",
          },
          ai_generated_transcript: {
            type: "string",
            description:
              "100% faithful transcript of what the candidate actually uttered in audio.",
          },
          match_percentage: {
            type: "number",
            description:
              "Similarity percentage (0-100) between browser STT and actual audio transcript.",
          },
          feedback: {
            type: "string",
            description:
              "Concise 1-2 sentence examiner assessment of pronunciation, fluency, vocabulary, and grammar for this answer.",
          },
          grammar_corrections: {
            type: "array",
            items: { type: "string" },
            description: "Specific grammar or word choice corrections.",
          },
          improved_version: {
            type: "string",
            description:
              "Concise Band 8.5+ model answer (2-3 sentences max for Part 1/3, 4-5 sentences max for Part 2).",
          },
        },
        required: [
          "question_id",
          "live_stt_transcript",
          "ai_generated_transcript",
          "match_percentage",
          "feedback",
        ],
      },
    },
  },
  required: [
    "overall_band",
    "estimated_band_reason",
    "fluency_coherence",
    "lexical_resource",
    "grammatical_range_accuracy",
    "pronunciation",
    "overall_feedback",
    "criterion_feedback",
    "criterion_key_observations",
    "filler_words",
    "vocab_upgrades",
    "strengths",
    "weaknesses",
    "per_question_items",
  ],
};
