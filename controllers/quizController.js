const mongoose = require('mongoose');
const Quiz = mongoose.model('Quiz');
const CurrentQuiz = mongoose.model('CurrentQuiz');
const Question = mongoose.model('Question');
const QuestionResponse = mongoose.model('QuestionResponse');
const QuizHistory = mongoose.model('QuizHistory');

// Returns the list of questions for the current Quiz
exports.getCurrentQuiz = async (req, res) => {
  // get the current Quiz object
  let currentQuiz = await CurrentQuiz.findOne().populate([
    {
      path: 'currentQuizId',
      model: 'Quiz',
      populate: {
        path: 'questions',
        model: 'Question'
      }
    }
  ]);

  const questions = currentQuiz.currentQuizId.questions;
  res.json(questions);
};

// Create a new Quiz
exports.addQuiz = async (req, res) => {
  const newQuiz = await new Quiz({
    startTime: new Date(req.body.startTime),
    endTime: new Date(req.body.endTime),
    questions: req.body.questions,
    description: req.body.description || ''
  }).save();

  res.json(newQuiz);
};

// TODO
// The object ID of current quiz will be present
// in req.body.currentQuizId
exports.setCurrentQuiz = async (req, res) => {
  // get currentQuiz from DB
  const currentQuiz = await CurrentQuiz.findOne();

  // Update it's currentQuizId
  if (req.body.currentQuizId) {
    currentQuiz['currentQuizId'] = req.body.currentQuizId;
    currentQuiz.save();
  }
  res.json(currentQuiz);
};

// Submit Current Quiz
exports.submitCurrentQuiz = async (req, res) => {
  // get currentQuiz from DB
  const currentQuiz = await CurrentQuiz.findOne();
  const currentQuizId = currentQuiz.currentQuizId.toString();

  // If user has submitted already, return early
  if (req.user.lastSubmission === currentQuizId)
    return res
      .status(400)
      .json({ submissonError: 'You have already submitted this quiz!' });
  else {
    req.user.lastSubmission = currentQuizId;
    req.user.save();
  }

  const userResult = req.body.userResult;
  const userResponse = req.body.userResponse;

  // Save QuizHistory
  saveQuizHistory(req.user, currentQuizId, userResponse);

  // Right Now, Only one category per quiz is supported
  const quizCategory = userResult[0]['category'];

  let questionResponse;
  // if questionResponse exists for the current user
  // fetch questionResponse object
  if (req.user.questionResponse) {
    questionResponse = await QuestionResponse.findById(
      req.user.questionResponse
    ).select(quizCategory);
  } else {
    // otherwise create a new questionResponse object
    questionResponse = await new QuestionResponse().save();
    req.user.questionResponse = questionResponse._id;
    req.user.save(); // save the user
  }

  const answerArray = questionResponse[quizCategory];

  // loop over reponses
  for (let ques of userResult) {
    const found = answerArray.find((obj, i) => {
      if (obj.questionId.toString() === ques.quesId) {
        if (ques.correctAnswer)
          answerArray[i]['correctCount'] = answerArray[i]['correctCount'] + 1;
        else
          answerArray[i]['incorrectCount'] =
            answerArray[i]['incorrectCount'] + 1;
        return true; // stop searching
      }
    });

    // if not found
    if (!found) {
      answerArray.push({
        questionId: ques.quesId,
        correctCount: ques.correctAnswer ? 1 : 0,
        incorrectCount: ques.incorrectAnswer ? 1 : 0
      });
    }
  }

  questionResponse[quizCategory] = answerArray; // Update answerArray
  await questionResponse.save(); // save questionResponse object
  res.json({
    submissionSuccess: 'Your Quiz response was submitted successfully'
  });
};

exports.getQuizHistory = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ notLoggedIn: 'You need to be logged in!' });
  }

  console.log(req.user);

  if (!req.user.quizHistory) {
    console.log('I am here');
    return res.json({ emptyQuizHistory: 'No Quiz History found!' });
  }

  // fetch the quizHistory object
  const quizHistory = await QuizHistory.findById(req.user.quizHistory);
  const quizIds = quizHistory.quizIds;
  const userResponses = quizHistory.userResponses;

  let promises = [];
  for (let i = 0; i < quizIds.length; i++) {
    promises.push(Quiz.findById(quizIds[i]).populate('questions'));
  }

  const quizzes = await Promise.all(promises);

  res.json({
    quizzes,
    userResponses
  });
};

// Saves the quiz history
saveQuizHistory = async (user, currentQuizId, userResponse) => {
  let quizHistory;
  if (user.quizHistory) {
    // Fetch QuizHistory object for the user
    quizHistory = await QuizHistory.findById(user.quizHistory);
  } else {
    // Create a new QuizHistory object for the user
    quizHistory = await new QuizHistory().save();
    user.quizHistory = quizHistory._id;
    user.save();
  }

  const quizIds = quizHistory.quizIds;
  const userResponses = quizHistory.userResponses;

  // Check if there are already 3 items in quizIds array
  if (quizIds.length === 3) {
    // Pop oldest entry from both quizIds and userResponses array
    quizIds.shift();
    userResponses.shift();
  }

  // Push currentQuizId and userResponse to their respective arrays
  quizIds.push(currentQuizId);
  userResponses.push(userResponse);

  // Update quizHistory
  quizHistory.quizIds = quizIds;
  quizHistory.userResponses = userResponses;

  // Save quizHistory
  quizHistory.save();
};
