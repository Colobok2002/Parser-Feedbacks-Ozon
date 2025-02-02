// http://127.0.0.1:8001
// https://data.riche.one
// 27844
// E63ZQs1WnTPbyXC4C5ULyMdVYG0DKkFHb32vjxyg3TP7nqWckYqQrCFK

import axios from "axios";


interface StorageResult {
  work?: boolean;
  timer?: number;
  interval?: number;
}

interface Settings {
  apiUrl: string;
  companyId: string;
  headerApiKey: string;
  interval: number;
}

const getCookies = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    chrome.cookies.getAll({}, (cookies) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        const cookieString = cookies.map(cookie => `${encodeURIComponent(cookie.name)}=${encodeURIComponent(cookie.value)}`).join('; ');
        resolve(cookieString);
      }
    });
  });
};

const getSettings = (): Promise<Settings> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["ApiUrl", "company_id", "HeaderApiKey", "interval"], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        const apiUrl = result.ApiUrl || "";
        const companyId = result.company_id || "";
        const headerApiKey = result.HeaderApiKey || "";
        const interval = result.interval || 60;
        resolve({
          apiUrl,
          companyId,
          headerApiKey,
          interval
        });
      }
    });
  });
};

const convertBlobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

function apiToOzon(message): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({}, (tabs) => {
      let ozonTab = tabs.find(tab => tab.url && tab.url.includes('seller.ozon.ru'));

      if (ozonTab) {
        chrome.tabs.sendMessage(ozonTab.id!, message, (response) => {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          resolve(response);
        });
      } else {
        chrome.tabs.create({ url: 'https://seller.ozon.ru' }, (newTab) => {
          chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
            if (tabId === newTab.id && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              chrome.tabs.sendMessage(newTab.id!, message, (response) => {
                if (chrome.runtime.lastError) {
                  return reject(new Error(chrome.runtime.lastError.message));
                }
                resolve(response);
              });
            }
          });
        });
      }
    });
  });
}


const sendItemsBatch = async (reviews) => {
  const { apiUrl, headerApiKey, companyId } = await getSettings();
  const cookies = await getCookies();
  const data = reviews
    .filter(review => review.interaction_status !== "PROCESSED")
    .map(async (review: any) => {
      let additionalData = {};
      if (review.photos_count > 0 || review.videos_count > 0) {
        const response = await apiToOzon({
          action: 'fetchData',
          url: "https://seller.ozon.ru/api/v2/review/detail",
          options: {
            method: 'POST',
            headers: {
              "Content-Type": "application/json",
              "Origin": "https://seller.ozon.ru",
              "X-O3-Company-Id": companyId,
            },
            body: JSON.stringify({
              "company_type": "seller",
              "company_id": companyId,
              "review_uuid": review.uuid
            })
          }
        });

        const responseData = response.data;
        if (responseData.photos) {
          const photosData = await Promise.all(responseData.photos.map(async (photo: any) => {
            const photoResponse = await fetch(photo.url);
            const blob = await photoResponse.blob();
            const base64Data = await convertBlobToBase64(blob);
            const fileName = photo.url.split('/').pop();
            return {
              data: base64Data,
              name: fileName
            };
          }));

          additionalData["photos"] = photosData;
        }

        if (responseData.videos) {
          const videosData = await Promise.all(responseData.videos.map(async (video: any) => {
            const fileName = video.url.split('/').pop();
            return {
              data: video.url,
              name: fileName
            };
          }));


          additionalData["videos"] = videosData;
        }

      }

      return {
        prod_art: review.product.offer_id,
        prod_name: review.product.title,
        feedback_ID: review.uuid,
        rating: review.rating,
        positive: review.text.positive,
        negative: review.text.negative,
        comment: review.text.comment,
        market: "ozon",
        dateTimeFeedback: review.published_at,
        author_name_to_market: review.author_name,
        ...additionalData
      };
    });

  const resolvedData = await Promise.all(data);


  try {
    await axios.post(`${apiUrl}/feedbacks/add-feedbacks/`, { feedbacks: resolvedData }, {
      headers: {
        "HeaderApiKey": headerApiKey
      }
    });
  } catch (err) {
    console.error(err);
  }

};


const sendQuestionsBatch = async (questions) => {
  const { apiUrl, headerApiKey } = await getSettings();

  const data = questions.map((question: any) => {
    return {
      prod_art: question.product.offer_id,
      prod_name: question.product.title,
      author_name_to_market: question.author.name,
      question_ID: question.id,
      question: question.text,
      market: "ozon",
      dateTimeQuestion: question.published_at,
    };
  });


  try {
    await axios.post(`${apiUrl}/feedbacks/add-question/`, { questions: data }, {
      headers: {
        "HeaderApiKey": headerApiKey
      }
    });
  } catch (err) {
    console.error(err);
  }

};

const getFeedback = async () => {


  const { companyId } = await getSettings();
  let pagination_last_timestamp = null;
  let pagination_last_uuid = null;
  let unprocessedReviews = [];
  let data;

  while (true) {
    try {
      const response = await apiToOzon({
        action: 'fetchData',
        url: 'https://seller.ozon.ru/api/v3/review/list',
        options: {
          method: 'POST',
          headers: {
            "Content-Type": "application/json",
            "Origin": "https://seller.ozon.ru",
            "X-O3-Company-Id": companyId,
          },
          body: JSON.stringify({
            "with_counters": false,
            "sort": { "sort_by": "PUBLISHED_AT", "sort_direction": "DESC" },
            "company_type": "seller",
            "filter": { "interaction_status": ["NOT_VIEWED"] },
            "company_id": companyId,
            "pagination_last_timestamp": pagination_last_timestamp,
            "pagination_last_uuid": pagination_last_uuid
          }),
          credentials: 'include'
        }
      });

      if (response.success) {
        data = response.data;
        const newUnprocessed = data.result.filter(item => item.interaction_status !== 'PROCESSED');
        unprocessedReviews = [...unprocessedReviews, ...newUnprocessed];

        pagination_last_timestamp = data.pagination_last_timestamp;
        pagination_last_uuid = data.pagination_last_uuid;

        if (!pagination_last_timestamp || !pagination_last_uuid) {
          break;
        }
      } else {
        console.error('Error fetching data feedback:', response.error);
        break;
      }

    } catch (error) {
      console.error('Error feedback:', error.message);
      break;
    }
  };


  pagination_last_timestamp = null;
  pagination_last_uuid = null;

  while (true) {
    try {
      const response = await apiToOzon({
        action: 'fetchData',
        url: 'https://seller.ozon.ru/api/v3/review/list',
        options: {
          method: 'POST',
          headers: {
            "Content-Type": "application/json",
            "Origin": "https://seller.ozon.ru",
            "X-O3-Company-Id": companyId,
          },
          body: JSON.stringify({
            "with_counters": false,
            "sort": { "sort_by": "PUBLISHED_AT", "sort_direction": "DESC" },
            "company_type": "seller",
            "filter": { "interaction_status": ["VIEWED"] },
            "company_id": companyId,
            "pagination_last_timestamp": pagination_last_timestamp,
            "pagination_last_uuid": pagination_last_uuid
          }),
          credentials: 'include'
        }
      });

      if (response.success) {
        data = response.data;
        const newUnprocessed = data.result.filter(item => item.interaction_status !== 'PROCESSED');
        unprocessedReviews = [...unprocessedReviews, ...newUnprocessed];

        pagination_last_timestamp = data.pagination_last_timestamp;
        pagination_last_uuid = data.pagination_last_uuid;

        if (!pagination_last_timestamp || !pagination_last_uuid) {
          break;
        }
      } else {
        console.error('Error fetching data feedback:', response.error);
        break;
      }

    } catch (error) {
      console.error('Error feedback:', error.message);
      break;
    }
  }

  chrome.storage.local.set({ feedback: unprocessedReviews.length });
  sendItemsBatch(unprocessedReviews);

}

const getQuestions = async () => {

  const { companyId } = await getSettings();
  let pagination_last_id = 0;
  let unprocessedReviews = [];
  let data;

  while (true) {
    try {
      const response = await apiToOzon({
        action: 'fetchData',
        url: 'https://seller.ozon.ru/api/v1/question-list',
        options: {
          method: 'POST',
          headers: {
            "Content-Type": "application/json",
            "Origin": "https://seller.ozon.ru",
            "X-O3-Company-Id": companyId,
          },
          body: JSON.stringify({
            "sc_company_id": companyId,
            "with_brands": false,
            "with_counters": false,
            "company_type": "seller",
            "filter": { "status": "NEW" },
            "pagination_last_id": pagination_last_id
          })
        }
      });

      if (response.success) {
        data = response.data;

        unprocessedReviews = [...unprocessedReviews, ...data.result];

        pagination_last_id = data.pagination_last_id;

        if (!data.has_next) {
          break;
        }

      } else {
        console.error('Error fetching data question:', response.error);
        break;
      }

    } catch (error) {
      console.error('Error question:', error.message);
      break;
    }

  }

  pagination_last_id = 0

  while (true) {
    try {
      const response = await apiToOzon({
        action: 'fetchData',
        url: 'https://seller.ozon.ru/api/v1/question-list',
        options: {
          method: 'POST',
          headers: {
            "Content-Type": "application/json",
            "Origin": "https://seller.ozon.ru",
            "X-O3-Company-Id": companyId,
          },
          body: JSON.stringify({
            "sc_company_id": companyId,
            "with_brands": false,
            "with_counters": false,
            "company_type": "seller",
            "filter": { "status": "VIEWED" },
            "pagination_last_id": pagination_last_id
          })
        }
      });

      if (response.success) {
        data = response.data;

        unprocessedReviews = [...unprocessedReviews, ...data.result];

        pagination_last_id = data.pagination_last_id;

        if (!data.has_next) {
          break;
        }

      } else {
        console.error('Error fetching data question:', response.error);
        break;
      }

    } catch (error) {
      console.error('Error question:', error.message);
      break;
    }

  }

  chrome.storage.local.set({ questions: unprocessedReviews.length });
  sendQuestionsBatch(unprocessedReviews);
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
    const response = await apiToOzon({
      action: 'fetchData',
      url: 'https://seller.ozon.ru/api/review/comment/create',
      options: {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Origin": "https://seller.ozon.ru",
          "X-O3-Company-Id": companyId,
        },
        body: JSON.stringify(data)
      }
    });

    if (!response.success) {
      return false;
    }
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

const ansverQuestion = async (question_id, text) => {
  const { companyId } = await getSettings();
  const data = {
    "question_id": question_id,
    "text": text,
    "company_type": "seller",
    "sc_company_id": companyId
  };
  try {
    const cookies = await getCookies();
    const response = await apiToOzon({
      action: 'fetchData',
      url: "https://seller.ozon.ru/api/v1/create-answer",
      options: {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Origin": "https://seller.ozon.ru",
          "X-O3-Company-Id": companyId,
        },
        body: JSON.stringify(data)
      }
    });


    if (!response.success) {
      return false;
    }

    return true;

  } catch (error) {
    console.error(error);
    return false;
  }
};

const updateFeedbackStatus = async (feedbackId, status) => {
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
    console.error(error);
  }
};

const updateQuestionStatus = async (question_ID, status) => {
  const { apiUrl, headerApiKey } = await getSettings();
  try {
    const response = await axios.post(`${apiUrl}/feedbacks/change-status-questins`, {
      question_ID: question_ID,
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
    console.error(error);
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
    await Promise.all(data.map(async (feedback) => {
      const success = await ansverRiviev(feedback.feedback_ID, feedback.ansver);
      const status = success ? "success" : "error";
      await updateFeedbackStatus(feedback.id, status);
    }));
  } catch (error) {
    console.error(error);
  }
};

const processQuestions = async () => {
  const { apiUrl, headerApiKey } = await getSettings();
  try {
    const response = await axios.get(`${apiUrl}/feedbacks/get-question-to-markets/?market=ozon`, {
      headers: {
        "HeaderApiKey": headerApiKey
      }
    });

    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const { data } = response.data;
    await Promise.all(data.map(async (question: any) => {
      const success = await ansverQuestion(question.question_ID, question.ansver);
      const status = success ? "success" : "error";
      await updateQuestionStatus(question.id, status);
    }));
  } catch (error) {
    console.error(error);
  }
};

const checkAndProcessFeedbacks = async () => {
  const { work, timer, interval } = await new Promise<StorageResult>((resolve) => {
    chrome.storage.local.get(["work", "timer", "interval"], (result) => resolve(result as StorageResult));
  });
  console.log("[ ? ] WorkStatus ", work)
  if (work) {
    let newTimer = timer > 1 ? timer - 1 : interval;
    chrome.storage.local.set({ timer: newTimer });
    if (newTimer === 1) {
      await getFeedback();
      await processFeedbacks();
      await getQuestions()
      await processQuestions()
    }
  } else {
    chrome.storage.local.set({ timer: interval });
  }
};

const checkAuthorization = async () => {
  try {
    const cookies = await getCookies();
    const { companyId } = await getSettings();
    const pagination_last_timestamp = null;
    const pagination_last_uuid = null;

    const response = await apiToOzon({
      action: 'fetchData',
      url: 'https://seller.ozon.ru/api/v3/review/list',
      options: {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Origin": "https://seller.ozon.ru",
          "X-O3-Company-Id": companyId,
        },
        body: JSON.stringify({
          "with_counters": false,
          "sort": { "sort_by": "PUBLISHED_AT", "sort_direction": "DESC" },
          "company_type": "seller",
          "filter": { "interaction_status": ["NOT_VIEWED"] },
          "company_id": companyId,
          "pagination_last_timestamp": pagination_last_timestamp,
          "pagination_last_uuid": pagination_last_uuid
        }),
        credentials: 'include'
      }
    });

    if (!response.success) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const _ = await response.data;

  } catch (error) {
    chrome.tabs.query({ url: "https://seller.ozon.ru/*" }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.reload(tabs[0].id);
      } else {
        chrome.tabs.create({ url: "https://seller.ozon.ru/app" });
      }
    });
    console.error('[ - ] Authorization check failed:', error);
  }
};

chrome.alarms.create("feedbackInterval", { periodInMinutes: 1 / 60 });
chrome.alarms.create("checkAuthorizationInterval", { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "feedbackInterval") {
    checkAndProcessFeedbacks();
  } else if (alarm.name === "checkAuthorizationInterval") {
    checkAuthorization();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ timer: 60, work: false, interval: 60, feedback: 0, questions: 0 });
});


chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === "local" && changes.work) {
    const oldValue = changes.work.oldValue;
    const newValue = changes.work.newValue;
    if (oldValue === false && newValue === true) {
      await getFeedback();
      await processFeedbacks();
      await getQuestions();
      await processQuestions();


    }
  }
});



