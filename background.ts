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

const getSettings = (): Promise<{ apiUrl: string; companyId: string; headerApiKey: string }> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["ApiUrl", "company_id", "HeaderApiKey"], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        const apiUrl = result.ApiUrl || "";
        const companyId = result.company_id || "";
        const headerApiKey = result.HeaderApiKey || "";
        resolve({
          apiUrl,
          companyId,
          headerApiKey
        });
      }
    });
  });
};

const sendItemsBatch = async (reviews) => {
  const { apiUrl, headerApiKey } = await getSettings();
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
      await axios.post(`${apiUrl}/feedbacks/add-feedbacks/`, { feedbacks: data }, {
        headers: {
          "HeaderApiKey": headerApiKey
        }
      });
    } catch (err) {
    }
  } else {
  }
};

const getFeedback = async () => {
  try {
    const cookies = await getCookies();
    const { companyId } = await getSettings();
    let pagination_last_timestamp = null;
    let pagination_last_uuid = null;
    let allReviews = [];
    let unprocessedReviews = [];

    while (true) {
      const response = await fetch("https://seller.ozon.ru/api/v3/review/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": cookies,
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
          "Cookie": cookies,
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
  }
};

const ansverRiviev = async (review_uuid, text) => {
  const { companyId } = await getSettings();
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
        "Cookie": cookies,
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    return true;

  } catch (error) {
    console.log(error)
    return false;
  }
};

const updateFeedbackStatus = async (feedbackId, status) => {
  console.log(status)
  const { apiUrl, headerApiKey } = await getSettings();
  try {
    const response = await axios.post(`${apiUrl}/feedbacks/change-status-feedbacks/`, {
      feedbackId: feedbackId,
      status: status
    }, {
      headers: {
        "HeaderApiKey": headerApiKey
      }
    });
    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
  }
};

const processFeedbacks = async () => {
  const { apiUrl, headerApiKey } = await getSettings();
  try {
    const response = await axios.get(`${apiUrl}/feedbacks/get-feedbacks-to-markets/?market=ozon`, {
      headers: {
        "HeaderApiKey": headerApiKey
      }
    });

    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const { data } = response.data;
    const results = await Promise.all(data.map(async (feedback) => {
      const success = await ansverRiviev(feedback.feedback_ID, feedback.ansver);
      const status = success ? "success" : "error";
      await updateFeedbackStatus(feedback.id, status);
      return success;
    }));
  } catch (error) {
  }
};

const startIntervals = async () => {
  const state = store.getState();
  const interval_time = state.feedback.interval;
  const work = state.feedback.work;
  console.log("Work status", work);
  if (work) {
    const newTimer = state.feedback.timer > 1 ? state.feedback.timer - 1 : interval_time;
    store.dispatch(setTimer(newTimer));
    if (newTimer === 1) {
      await getFeedback();
      await processFeedbacks()
    }
  } else {
    store.dispatch(setTimer(interval_time));
  }
};

chrome.alarms.create('feedbackInterval', { periodInMinutes: 0.01 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'feedbackInterval') {
    startIntervals()
  }
});