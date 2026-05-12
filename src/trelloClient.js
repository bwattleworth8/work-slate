const TRELLO_API_BASE = "https://api.trello.com/1";

class TrelloClient {
  constructor(credentials) {
    this.apiKey = credentials?.apiKey || "";
    this.token = credentials?.token || "";
  }

  hasCredentials() {
    return Boolean(this.apiKey && this.token);
  }

  async request(pathname, options = {}) {
    if (!this.hasCredentials()) {
      throw new Error("Trello credentials have not been configured.");
    }

    const url = new URL(`${TRELLO_API_BASE}${pathname}`);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("token", this.token);

    for (const [key, value] of Object.entries(options.query || {})) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(formatTrelloError(response.status, detail || response.statusText));
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  async getBoards() {
    const boards = await this.request("/members/me/boards", {
      query: {
        filter: "open",
        fields: "id,name,url"
      }
    });

    return boards
      .map((board) => ({
        id: board.id,
        name: board.name,
        url: board.url
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getBoardCards(boardId) {
    if (!boardId) {
      throw new Error("Choose a Trello board before loading tasks.");
    }

    const cards = await this.request(`/boards/${boardId}/cards`, {
      query: {
        filter: "open",
        fields: "id,name,desc,due,dueComplete,dateLastActivity,url,idList,labels,isTemplate,cover",
        customFieldItems: "true",
        members: "false"
      }
    });

    const [lists, customFields] = await Promise.all([
      this.request(`/boards/${boardId}/lists`, {
        query: {
          filter: "open",
          fields: "id,name,pos"
        }
      }),
      this.getBoardCustomFields(boardId)
    ]);

    const timeSpentField = findTimeSpentField(customFields);
    const listsById = new Map(
      lists.map((list) => [
        list.id,
        {
          name: list.name,
          pos: Number(list.pos || 0)
        }
      ])
    );

    return cards
      .filter((card) => !isCompletedCard(card, listsById.get(card.idList)?.name))
      .map((card) =>
        normalizeCard(
          card,
          listsById.get(card.idList) || { name: "Unknown list", pos: Number.MAX_SAFE_INTEGER },
          timeSpentField
        )
      )
      .sort(compareCards);
  }

  async getBoardLists(boardId) {
    if (!boardId) {
      throw new Error("Choose a Trello board before loading lists.");
    }

    const lists = await this.request(`/boards/${boardId}/lists`, {
      query: {
        filter: "open",
        fields: "id,name,pos"
      }
    });

    return lists
      .filter((list) => !isCompletedListName(list.name))
      .map((list) => ({
        id: list.id,
        name: list.name,
        pos: list.pos
      }))
      .sort((a, b) => Number(a.pos || 0) - Number(b.pos || 0));
  }

  async getBoardTemplateCards(boardId) {
    if (!boardId) {
      throw new Error("Choose a Trello board before loading template cards.");
    }

    const cards = await this.request(`/boards/${boardId}/cards`, {
      query: {
        filter: "open",
        fields: "id,name,url,idList,isTemplate,cover"
      }
    });

    return cards
      .filter(isTemplateCard)
      .map((card) => ({
        id: card.id,
        name: card.name,
        url: card.url,
        listId: card.idList
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getBoardLabels(boardId) {
    if (!boardId) {
      throw new Error("Choose a Trello board before loading labels.");
    }

    const labels = await this.request(`/boards/${boardId}/labels`, {
      query: {
        fields: "id,name,color"
      }
    });

    return labels
      .map((label) => ({
        id: label.id,
        name: label.name || formatLabelColor(label.color),
        color: label.color || "gray"
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getBoardMembers(boardId) {
    if (!boardId) {
      throw new Error("Choose a Trello board before loading members.");
    }

    const members = await this.request(`/boards/${boardId}/members`, {
      query: {
        filter: "all",
        fields: "id,fullName,username"
      }
    });

    return members
      .map((member) => ({
        id: member.id,
        name: member.fullName || member.username || "Unnamed member",
        username: member.username || ""
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getBoardCustomFields(boardId) {
    if (!boardId) {
      throw new Error("Choose a Trello board before loading custom fields.");
    }

    return this.request(`/boards/${boardId}/customFields`, {
      query: {
        fields: "id,name,type,options"
      }
    });
  }

  async getBoardPriorityField(boardId) {
    const customFields = await this.getBoardCustomFields(boardId);
    return normalizeListCustomField(findPriorityField(customFields), "Priority");
  }

  async addTimeSpent(boardId, cardId, minutes) {
    if (!boardId) {
      throw new Error("Choose a Trello board before tracking time.");
    }

    if (!cardId) {
      throw new Error("Missing Trello card id.");
    }

    const minutesToAdd = Number(minutes);
    if (!Number.isFinite(minutesToAdd) || minutesToAdd <= 0) {
      throw new Error("Track at least one minute before saving time.");
    }

    const customFields = await this.getBoardCustomFields(boardId);
    const timeSpentField = findTimeSpentField(customFields);

    if (!timeSpentField) {
      throw new Error('Create a Trello number custom field named "Time Spent (mins)" on this board before tracking time.');
    }

    if (timeSpentField.type !== "number") {
      throw new Error('The Trello custom field "Time Spent (mins)" must be a number field.');
    }

    const card = await this.request(`/cards/${cardId}`, {
      query: {
        fields: "id,name",
        customFieldItems: "true"
      }
    });

    const currentMinutes = getCardTimeSpent(card, timeSpentField) || 0;
    const totalMinutes = currentMinutes + minutesToAdd;

    await this.request(`/card/${cardId}/customField/${timeSpentField.id}/item`, {
      method: "PUT",
      body: {
        value: {
          number: String(totalMinutes)
        }
      }
    });

    return {
      cardId,
      minutesAdded: minutesToAdd,
      totalMinutes
    };
  }

  async completeCard(cardId) {
    if (!cardId) {
      throw new Error("Missing Trello card id.");
    }

    return this.request(`/cards/${cardId}`, {
      method: "PUT",
      query: {
        dueComplete: "true"
      }
    });
  }

  async addCardComment(cardId, text) {
    if (!cardId) {
      throw new Error("Missing Trello card id.");
    }

    const commentText = String(text || "").trim();
    if (!commentText) {
      throw new Error("Write a note before saving it to Trello.");
    }

    return this.request(`/cards/${cardId}/actions/comments`, {
      method: "POST",
      query: {
        text: commentText
      }
    });
  }

  async createCardFromTemplate(boardId, sourceCardId, listId, name, options = {}) {
    if (!boardId) {
      throw new Error("Choose a Trello board before creating tasks.");
    }

    if (!sourceCardId) {
      throw new Error("Choose a Quick Add template in Settings.");
    }

    if (!listId) {
      throw new Error("Choose a destination list.");
    }

    const cardName = String(name || "").trim();
    if (!cardName) {
      throw new Error("Enter a task title.");
    }

    const labelId = String(options.labelId || "").trim();
    const memberId = String(options.memberId || "").trim();
    const priorityOptionId = String(options.priorityOptionId || "").trim();
    const due = normalizeDueDateForTrello(options.dueDate);
    const start = getCurrentStartDateForTrello();
    const customFields = await this.getBoardCustomFields(boardId);
    const statusField = normalizeListCustomField(findStatusField(customFields), "Status");
    const todoStatusOption = findCustomFieldOptionByName(statusField, "to do");
    const priorityField = priorityOptionId
      ? normalizeListCustomField(findPriorityField(customFields), "Priority")
      : null;

    validateListCustomFieldOption(statusField, todoStatusOption?.id, "Status", "To do");
    if (priorityOptionId) {
      validateListCustomFieldOption(priorityField, priorityOptionId, "Priority");
    }

    const card = await this.request("/cards", {
      method: "POST",
      query: {
        idList: listId,
        idCardSource: sourceCardId,
        keepFromSource: "all",
        name: cardName,
        ...(labelId ? { idLabels: labelId } : {}),
        ...(memberId ? { idMembers: memberId } : {}),
        ...(due ? { due } : {}),
        start,
        fields: "id,name,url,idList,due,start,dueComplete,dateLastActivity,labels"
      }
    });

    await this.setListCustomFieldOption(card.id, statusField, todoStatusOption.id, "Status");

    if (priorityOptionId) {
      await this.setListCustomFieldOption(card.id, priorityField, priorityOptionId, "Priority");
    }

    return {
      id: card.id,
      name: card.name,
      url: card.url,
      listId: card.idList,
      due: card.due || null,
      start: card.start || start,
      dueComplete: Boolean(card.dueComplete),
      lastActivity: card.dateLastActivity,
      labels: (card.labels || []).map((label) => ({
        id: label.id,
        name: label.name || formatLabelColor(label.color),
        color: label.color || "gray"
      })),
      status: getDueStatus(card.due)
    };
  }

  async setListCustomFieldOption(cardId, customField, optionId, fieldLabel) {
    if (!cardId) {
      throw new Error("Missing Trello card id.");
    }

    const normalizedOptionId = String(optionId || "").trim();
    validateListCustomFieldOption(customField, normalizedOptionId, fieldLabel);

    return this.request(`/card/${cardId}/customField/${customField.id}/item`, {
      method: "PUT",
      body: {
        idValue: normalizedOptionId
      }
    });
  }
}

function normalizeCard(card, list, timeSpentField) {
  return {
    id: card.id,
    name: card.name,
    description: card.desc || "",
    due: card.due,
    dueComplete: Boolean(card.dueComplete),
    lastActivity: card.dateLastActivity,
    url: card.url,
    listId: card.idList,
    listName: list.name,
    listPos: Number(list.pos || 0),
    labels: (card.labels || []).map((label) => ({
      id: label.id,
      name: label.name || label.color || "Label",
      color: label.color || "gray"
    })),
    timeSpentMins: getCardTimeSpent(card, timeSpentField),
    status: getDueStatus(card.due)
  };
}

function findTimeSpentField(customFields) {
  return (customFields || []).find((field) => normalizeFieldName(getCustomFieldName(field)) === "time spent (mins)");
}

function findPriorityField(customFields) {
  return (customFields || []).find((field) => normalizeFieldName(getCustomFieldName(field)) === "priority");
}

function findStatusField(customFields) {
  return (customFields || []).find((field) => normalizeFieldName(getCustomFieldName(field)) === "status");
}

function getCustomFieldName(field) {
  return field?.name || field?.display?.name || "";
}

function getCustomFieldOptions(field) {
  const options = field?.options || field?.display?.options || [];
  return Array.isArray(options) ? options : [];
}

function normalizeListCustomField(field, fallbackName) {
  if (!field) {
    return null;
  }

  return {
    id: field.id,
    name: getCustomFieldName(field) || fallbackName,
    type: field.type,
    options: getCustomFieldOptions(field)
      .map((option) => ({
        id: option.id,
        name: option.value?.text || `Unnamed ${fallbackName.toLowerCase()}`,
        color: option.color || "none",
        pos: option.pos || 0
      }))
      .sort((a, b) => Number(a.pos || 0) - Number(b.pos || 0))
  };
}

function findCustomFieldOptionByName(field, optionName) {
  const normalizedOptionName = normalizeFieldName(optionName);
  return (field?.options || []).find((option) => normalizeFieldName(option.name) === normalizedOptionName);
}

function validateListCustomFieldOption(customField, optionId, fieldLabel, optionLabel) {
  if (!customField) {
    throw new Error(`Create a Trello dropdown custom field named "${fieldLabel}" before setting ${fieldLabel.toLowerCase()}.`);
  }

  if (customField.type !== "list") {
    throw new Error(`The Trello custom field "${fieldLabel}" must be a dropdown field.`);
  }

  if (!customField.options.some((option) => option.id === optionId)) {
    const optionText = optionLabel ? ` named "${optionLabel}"` : "";
    throw new Error(`Choose a valid ${fieldLabel.toLowerCase()} option${optionText}.`);
  }
}

function isCompletedCard(card, listName) {
  return Boolean(card.dueComplete) || isCompletedListName(listName) || isTemplateCard(card);
}

function isCompletedListName(listName) {
  const normalizedListName = normalizeFieldName(listName).replace(/[^a-z0-9]+/g, " ").trim();
  return ["complete", "completed", "done"].includes(normalizedListName);
}

function isTemplateCard(card) {
  return Boolean(card.isTemplate) || Boolean(card.cover?.isTemplate);
}

function getCardTimeSpent(card, timeSpentField) {
  if (!timeSpentField) {
    return null;
  }

  const item = (card.customFieldItems || []).find(
    (customFieldItem) => customFieldItem.idCustomField === timeSpentField.id
  );

  const value = Number(item?.value?.number || 0);
  return Number.isFinite(value) ? value : 0;
}

function normalizeFieldName(name) {
  return String(name || "").trim().toLowerCase();
}

function formatLabelColor(color) {
  const normalizedColor = String(color || "").trim();
  if (!normalizedColor) {
    return "Unnamed label";
  }

  return `${normalizedColor.charAt(0).toUpperCase()}${normalizedColor.slice(1)} label`;
}

function normalizeDueDateForTrello(dueDate) {
  const normalizedDueDate = String(dueDate || "").trim();
  if (!normalizedDueDate) {
    return "";
  }

  const match = normalizedDueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error("Choose a valid due date.");
  }

  const [, year, month, day] = match.map(Number);
  const due = new Date(year, month - 1, day, 12, 0, 0);
  if (
    due.getFullYear() !== year ||
    due.getMonth() !== month - 1 ||
    due.getDate() !== day
  ) {
    throw new Error("Choose a valid due date.");
  }

  return due.toISOString();
}

function getCurrentStartDateForTrello() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).toISOString();
}

function getDueStatus(due) {
  if (!due) {
    return "none";
  }

  const now = new Date();
  const dueDate = new Date(due);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);

  if (dueDate < now) {
    return "overdue";
  }

  if (dueDate < tomorrowStart) {
    return "today";
  }

  return "upcoming";
}

function compareCards(a, b) {
  const rank = {
    overdue: 0,
    today: 1,
    upcoming: 2,
    none: 3
  };

  const rankDifference = rank[a.status] - rank[b.status];
  if (rankDifference !== 0) {
    return rankDifference;
  }

  if (a.due && b.due) {
    return new Date(a.due).getTime() - new Date(b.due).getTime();
  }

  if (a.due) {
    return -1;
  }

  if (b.due) {
    return 1;
  }

  return new Date(b.lastActivity || 0).getTime() - new Date(a.lastActivity || 0).getTime();
}

function formatTrelloError(status, detail) {
  const normalizedDetail = String(detail || "").trim();
  const lowerDetail = normalizedDetail.toLowerCase();

  if (status === 401 && lowerDetail.includes("invalid key")) {
    return "Trello rejected the API key. Copy the generated API Key from Power-Up Admin, not the API Secret, then generate a token from that same API key.";
  }

  if (status === 401 && lowerDetail.includes("invalid token")) {
    return "Trello rejected the token. Generate a fresh token from the Token link beside the same API key you entered.";
  }

  if (status === 401) {
    return `Trello rejected the credentials (${normalizedDetail || "unauthorized"}). Check that you are using a matching API key and token.`;
  }

  return `Trello request failed (${status}): ${normalizedDetail}`;
}

module.exports = {
  TrelloClient,
  compareCards,
  getDueStatus
};
