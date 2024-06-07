import axios from "axios";
import { persistor, store } from '~store';
import { setFeedback, setTimer } from '~feedbackSlice';

const getCookies = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    chrome.cookies.getAll({}, (cookies) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        resolve(cookieString);
      }
    });
  });
};

const getSettings = () => {
  const apiUrl = localStorage.getItem("ApiUrl");
  const companyId = localStorage.getItem("company_id");
  return { apiUrl, companyId };
};

const sendItemsBatch = async (reviews) => {
  const { apiUrl } = getSettings();
  const data = reviews
    .filter(review => review.interaction_status !== "PROCESSED")
    .map(review => ({
      prod_art: review.product.offer_id,
      prod_name: review.product.title,
      feedback_ID: review.uuid,
      rating: review.rating,
      positive: review.text.positive,
      negative: review.text.negative,
      comment: review.text.comment,
      market: "ozon",
      dateTimeFeedback: review.published_at
    }));

  if (data.length > 0) {
    try {
      console.log(data);
      await axios.post(`${apiUrl}/feedbacks/add-feedbacks/`, { feedbacks: data });
      console.log("Batch send successful");
    } catch (err) {
      console.log(err.response.data);
    }
  } else {
    console.log("No unprocessed reviews to send");
  }
};

const getFeedback = async () => {
  try {
    const cookies = await getCookies();
    const { companyId } = getSettings();
    let pagination_last_timestamp = null;
    let pagination_last_uuid = null;
    let allReviews = [];
    let unprocessedReviews = [];

    while (true) {
      const response = await fetch("https://seller.ozon.ru/api/v3/review/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": cookies
        },
        body: JSON.stringify({
          "with_counters": false,
          "sort": { "sort_by": "PUBLISHED_AT", "sort_direction": "DESC" },
          "company_type": "seller",
          "filter": { "interaction_status": ["NOT_VIEWED"] },
          "company_id": companyId,
          "pagination_last_timestamp": pagination_last_timestamp,
          "pagination_last_uuid": pagination_last_uuid
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      allReviews = [...allReviews, ...data.result];

      const newUnprocessed = data.result.filter(item => item.interaction_status !== 'PROCESSED');
      unprocessedReviews = [...unprocessedReviews, ...newUnprocessed];

      pagination_last_timestamp = data.pagination_last_timestamp;
      pagination_last_uuid = data.pagination_last_uuid;

      if (!pagination_last_timestamp || !pagination_last_uuid) {
        break;
      }
    }

    while (true) {
      const response = await fetch("https://seller.ozon.ru/api/v3/review/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": cookies
        },
        body: JSON.stringify({
          "with_counters": false,
          "sort": { "sort_by": "PUBLISHED_AT", "sort_direction": "DESC" },
          "company_type": "seller",
          "filter": { "interaction_status": ["VIEWED"] },
          "company_id": companyId,
          "pagination_last_timestamp": pagination_last_timestamp,
          "pagination_last_uuid": pagination_last_uuid
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      allReviews = [...allReviews, ...data.result];

      const newUnprocessed = data.result.filter(item => item.interaction_status !== 'PROCESSED');
      unprocessedReviews = [...unprocessedReviews, ...newUnprocessed];

      pagination_last_timestamp = data.pagination_last_timestamp;
      pagination_last_uuid = data.pagination_last_uuid;

      if (!pagination_last_timestamp || !pagination_last_uuid) {
        break;
      }
    }

    store.dispatch(setFeedback(unprocessedReviews.length));
    sendItemsBatch(unprocessedReviews);
  } catch (error) {
    console.error(error);
  }
};

const ansverRiviev = async (review_uuid, text) => {
  const { companyId } = getSettings();
  const data = {
    "review_uuid": review_uuid,
    "text": text,
    "company_type": "seller",
    "company_id": companyId
  };
  try {
    const cookies = await getCookies();
    const response = await fetch("https://seller.ozon.ru/api/review/comment/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookies
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      alert(response.status);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    alert("Ответ отправлен успешно!");
    return true;

  } catch (error) {
    console.log(error);
    return false;
  }
};


const updateFeedbackStatus = async (feedbackId, status) => {
  const { apiUrl } = getSettings();
  try {
    const response = await axios.post(`${apiUrl}/feedbacks/change-status-feedbacks`, {
      feedbackId: feedbackId,
      status: status
    });

    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log(`Feedback ${feedbackId} status updated to ${status}`);
  } catch (error) {
    console.log(`Error updating status for feedback ${feedbackId}:`, error);
  }
};

const processFeedbacks = async () => {
  const { apiUrl } = getSettings();
  try {
    const response = await axios.get(`${apiUrl}/feedbacks/get-feedbacks-to-markets/?market=ozon`);

    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const { data } = response.data;
    const results = await Promise.all(data.map(async (feedback) => {
      const success = await ansverRiviev(feedback.feedback_ID, feedback.ansver);
      const status = success ? "success" : "error";
      await updateFeedbackStatus(feedback.feedback_ID, status);
      return success;
    }));

    console.log('All feedbacks processed:', results);

  } catch (error) {
    console.log('Error processing feedbacks:', error);
  }
};


const startIntervals = async () => {
  setInterval(async () => {
    const state = store.getState();
    const interval_time = state.feedback.interval;
    const work = state.feedback.work;
    console.log(work);
    if (work) {
      const newTimer = state.feedback.timer > 1 ? state.feedback.timer - 1 : interval_time;
      store.dispatch(setTimer(newTimer));
      if (newTimer === 1) {
        await getFeedback();
      }
    } else {
      store.dispatch(setTimer(interval_time));
    }
  }, 900);
};

startIntervals();
