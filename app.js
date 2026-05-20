const USERNAME_KEY = "cleoms_sms_username";
const CONFIG_READY =
  typeof SUPABASE_URL === "string" &&
  typeof SUPABASE_ANON_KEY === "string" &&
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("COLLE_ICI") &&
  !SUPABASE_ANON_KEY.includes("COLLE_ICI");

const db = CONFIG_READY ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const DEFAULT_TITLE = document.title;

const elements = {
  profileInitial: document.querySelector("#profileInitial"),
  profileName: document.querySelector("#profileName"),
  usernameForm: document.querySelector("#usernameForm"),
  usernameInput: document.querySelector("#usernameInput"),
  usersList: document.querySelector("#usersList"),
  addUserForm: document.querySelector("#addUserForm"),
  newUserInput: document.querySelector("#newUserInput"),
  groupsList: document.querySelector("#groupsList"),
  groupForm: document.querySelector("#groupForm"),
  groupNameInput: document.querySelector("#groupNameInput"),
  groupMembersInput: document.querySelector("#groupMembersInput"),
  activeChatName: document.querySelector("#activeChatName"),
  clearChatButton: document.querySelector("#clearChatButton"),
  messages: document.querySelector("#messages"),
  messageForm: document.querySelector("#messageForm"),
  messageInput: document.querySelector("#messageInput")
};

const state = {
  currentUser: localStorage.getItem(USERNAME_KEY) || "",
  users: [],
  groups: [],
  messages: [],
  groupMessages: [],
  unreadCount: 0
};

let activeChat = null;
let realtimeChannel = null;
let knownDirectMessageIds = new Set();
let knownGroupMessageIds = new Set();
let hasLoadedRemoteState = false;

function updateAppHeight() {
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${viewportHeight}px`);
}

function cleanName(name, maxLength = 18) {
  return name.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function getInitial(name) {
  return name ? name.charAt(0).toUpperCase() : "?";
}

function showError(message) {
  elements.messages.innerHTML = "";
  const error = document.createElement("div");
  error.className = "empty-state";
  error.textContent = message;
  elements.messages.append(error);
}

function formatSupabaseError(prefix, error) {
  if (!error) {
    return prefix;
  }

  return [prefix, error.message, error.code].filter(Boolean).join(" ");
}

function updatePageTitle() {
  document.title = state.unreadCount > 0 ? `Nouveau message (${state.unreadCount})` : DEFAULT_TITLE;
}

function clearUnreadMessages() {
  state.unreadCount = 0;
  updatePageTitle();
}

function resetSessionState(username) {
  state.currentUser = username;
  state.users = [];
  state.groups = [];
  state.messages = [];
  state.groupMessages = [];
  state.unreadCount = 0;
  activeChat = null;
  knownDirectMessageIds = new Set();
  knownGroupMessageIds = new Set();
  hasLoadedRemoteState = false;
  updatePageTitle();
}

function getConversationMessages() {
  if (!state.currentUser || !activeChat) {
    return [];
  }

  if (activeChat.type === "group") {
    return state.groupMessages.filter((message) => message.group_id === activeChat.id);
  }

  return state.messages.filter((message) => {
    return (
      (message.sender === state.currentUser && message.receiver === activeChat.id) ||
      (message.sender === activeChat.id && message.receiver === state.currentUser)
    );
  });
}

function getActiveChatLabel() {
  if (!activeChat) {
    return "Choisis un utilisateur";
  }

  return activeChat.name || activeChat.id;
}

function trackIncomingMessages(directMessages, groupMessages) {
  const nextDirectIds = new Set(directMessages.map((message) => message.id));
  const nextGroupIds = new Set(groupMessages.map((message) => message.id));

  if (!hasLoadedRemoteState) {
    knownDirectMessageIds = nextDirectIds;
    knownGroupMessageIds = nextGroupIds;
    hasLoadedRemoteState = true;
    return;
  }

  const directIncoming = directMessages.filter((message) => {
    return (
      !knownDirectMessageIds.has(message.id) &&
      message.receiver === state.currentUser &&
      message.sender !== state.currentUser
    );
  }).length;

  const groupIncoming = groupMessages.filter((message) => {
    return !knownGroupMessageIds.has(message.id) && message.sender !== state.currentUser;
  }).length;

  if (directIncoming + groupIncoming > 0) {
    state.unreadCount += directIncoming + groupIncoming;
    updatePageTitle();
  }

  knownDirectMessageIds = nextDirectIds;
  knownGroupMessageIds = nextGroupIds;
}

function renderProfile() {
  const name = state.currentUser || "Invite";
  elements.profileName.textContent = name;
  elements.profileInitial.textContent = getInitial(name);
  elements.usernameInput.value = state.currentUser;
}

function createChatButton({ id, name, type, detail }) {
  const row = document.createElement("div");
  const button = document.createElement("button");
  const isActive = activeChat?.type === type && activeChat.id === id;
  row.className = `user-button${isActive ? " active" : ""}`;
  button.type = "button";
  button.className = "chat-select";
  button.innerHTML = `<span>${name}</span><small>${detail}</small>`;
  button.addEventListener("click", () => {
    activeChat = { id, name, type };
    clearUnreadMessages();
    render();
  });
  row.append(button);

  if (type === "direct") {
    const renameButton = document.createElement("button");
    renameButton.type = "button";
    renameButton.className = "rename-button";
    renameButton.textContent = "Renommer";
    renameButton.addEventListener("click", () => {
      handleRenameUser(id);
    });
    row.append(renameButton);
  }

  return row;
}

function renderUsers() {
  elements.usersList.innerHTML = "";

  if (state.users.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Ajoute un contact pour commencer.";
    elements.usersList.append(empty);
    return;
  }

  state.users.forEach((user) => {
    elements.usersList.append(
      createChatButton({
        id: user.username,
        name: user.username,
        type: "direct",
        detail: getInitial(user.username)
      })
    );
  });
}

function renderGroups() {
  elements.groupsList.innerHTML = "";

  if (state.groups.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Cree un groupe pour discuter a plusieurs.";
    elements.groupsList.append(empty);
    return;
  }

  state.groups.forEach((group) => {
    elements.groupsList.append(
      createChatButton({
        id: group.id,
        name: group.name,
        type: "group",
        detail: "Groupe"
      })
    );
  });
}

function renderChat() {
  elements.activeChatName.textContent = getActiveChatLabel();
  const messages = getConversationMessages();
  elements.messages.innerHTML = "";

  if (!CONFIG_READY) {
    showError("Ajoute ton URL Supabase et ta cle anon dans config.js.");
    return;
  }

  if (!state.currentUser || !activeChat) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Choisis ton nom et une discussion.";
    elements.messages.append(empty);
    return;
  }

  if (messages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = `Aucun message dans ${getActiveChatLabel()}.`;
    elements.messages.append(empty);
    return;
  }

  messages.forEach((message) => {
    const bubble = document.createElement("article");
    const isSent = message.sender === state.currentUser;
    bubble.className = `message ${isSent ? "sent" : "received"}`;
    bubble.textContent = message.content;

    const meta = document.createElement("span");
    meta.className = "message-meta";
    meta.textContent = `${message.sender} - ${new Date(message.created_at).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
    bubble.append(meta);
    elements.messages.append(bubble);
  });

  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function render() {
  renderProfile();
  renderUsers();
  renderGroups();
  renderChat();
}

function getUserContacts(contacts, messages) {
  const contactNames = new Set(contacts.map((contact) => contact.contact));

  messages.forEach((message) => {
    if (message.sender === state.currentUser) {
      contactNames.add(message.receiver);
    }

    if (message.receiver === state.currentUser) {
      contactNames.add(message.sender);
    }
  });

  return [...contactNames].filter(Boolean).sort((a, b) => a.localeCompare(b)).map((username) => ({ username }));
}

async function loadRemoteState() {
  if (!db) {
    render();
    return;
  }

  if (!state.currentUser) {
    resetSessionState("");
    render();
    return;
  }

  const [
    { data: contacts, error: contactsError },
    { data: directMessages, error: messagesError },
    { data: memberships, error: membershipsError }
  ] = await Promise.all([
    db.from("contacts").select("contact, created_at").eq("owner", state.currentUser).order("created_at", {
      ascending: true
    }),
    db.from("messages").select("id, sender, receiver, content, created_at").order("created_at", { ascending: true }),
    db
      .from("group_members")
      .select("group_id, groups(id, name, created_by, created_at)")
      .eq("username", state.currentUser)
      .order("created_at", { ascending: true })
  ]);

  if (contactsError || messagesError || membershipsError) {
    const error = contactsError || messagesError || membershipsError;
    showError(formatSupabaseError("Connexion Supabase impossible.", error));
    console.error("Erreur Supabase", error);
    return;
  }

  const groups = (memberships || []).map((membership) => membership.groups).filter(Boolean);
  const groupIds = groups.map((group) => group.id);
  let groupMessages = [];

  if (groupIds.length > 0) {
    const { data, error } = await db
      .from("group_messages")
      .select("id, group_id, sender, content, created_at")
      .in("group_id", groupIds)
      .order("created_at", { ascending: true });

    if (error) {
      showError(formatSupabaseError("Connexion Supabase impossible.", error));
      console.error("Erreur Supabase", error);
      return;
    }

    groupMessages = data || [];
  }

  state.messages = directMessages || [];
  state.groupMessages = groupMessages;
  trackIncomingMessages(state.messages, state.groupMessages);
  state.users = getUserContacts(contacts || [], state.messages);
  state.groups = groups.sort((a, b) => a.name.localeCompare(b.name));

  if (activeChat?.type === "direct" && !state.users.some((user) => user.username === activeChat.id)) {
    activeChat = null;
  }

  if (activeChat?.type === "group" && !state.groups.some((group) => group.id === activeChat.id)) {
    activeChat = null;
  }

  render();
}

async function saveUser(username) {
  const { error } = await db.from("users").insert({ username });
  if (error && error.code !== "23505") {
    showError("Impossible d'enregistrer cet utilisateur.");
    return false;
  }
  return true;
}

async function userExists(username) {
  const { data, error } = await db.from("users").select("username").eq("username", username).maybeSingle();
  if (error) {
    showError(formatSupabaseError("Impossible de verifier ce nom.", error));
    return true;
  }
  return Boolean(data);
}

async function updateRows(table, values, column, value) {
  const { error } = await db.from(table).update(values).eq(column, value);
  if (error) {
    showError(formatSupabaseError("Renommage impossible.", error));
    return false;
  }
  return true;
}

async function renameUser(oldName, newName) {
  if (!oldName || !newName || oldName === newName) {
    return false;
  }

  if (await userExists(newName)) {
    showError("Ce nom existe deja. Choisis un autre nom.");
    return false;
  }

  const saved = await saveUser(newName);
  if (!saved) {
    return false;
  }

  const updates = [
    updateRows("messages", { sender: newName }, "sender", oldName),
    updateRows("messages", { receiver: newName }, "receiver", oldName),
    updateRows("contacts", { owner: newName }, "owner", oldName),
    updateRows("contacts", { contact: newName }, "contact", oldName),
    updateRows("groups", { created_by: newName }, "created_by", oldName),
    updateRows("group_members", { username: newName }, "username", oldName),
    updateRows("group_messages", { sender: newName }, "sender", oldName)
  ];

  const results = await Promise.all(updates);
  return results.every(Boolean);
}

async function handleRenameUser(oldName) {
  const newName = cleanName(window.prompt(`Nouveau nom pour ${oldName}`, oldName) || "");
  if (!newName || newName === oldName) {
    return;
  }

  const renamed = await renameUser(oldName, newName);
  if (!renamed) {
    return;
  }

  if (state.currentUser === oldName) {
    resetSessionState(newName);
    localStorage.setItem(USERNAME_KEY, newName);
  }

  if (activeChat?.type === "direct" && activeChat.id === oldName) {
    activeChat = { id: newName, name: newName, type: "direct" };
  }

  await loadRemoteState();
}

async function saveContact(contact) {
  if (!state.currentUser || contact === state.currentUser) {
    return false;
  }

  const { error } = await db.from("contacts").insert({
    owner: state.currentUser,
    contact
  });

  if (error && error.code !== "23505") {
    showError("Impossible d'ajouter ce contact.");
    return false;
  }

  return true;
}

async function createGroup(name, members) {
  const allMembers = [...new Set([state.currentUser, ...members])].filter(Boolean);

  for (const member of allMembers) {
    const saved = await saveUser(member);
    if (!saved) {
      return null;
    }
  }

  const { data: group, error: groupError } = await db
    .from("groups")
    .insert({ name, created_by: state.currentUser })
    .select("id, name, created_by, created_at")
    .single();

  if (groupError) {
    showError(formatSupabaseError("Impossible de creer le groupe.", groupError));
    return null;
  }

  const rows = allMembers.map((username) => ({ group_id: group.id, username }));
  const { error: membersError } = await db.from("group_members").insert(rows);

  if (membersError) {
    showError(formatSupabaseError("Impossible d'ajouter les membres.", membersError));
    return null;
  }

  return group;
}

function subscribeToRealtime() {
  if (!db || realtimeChannel) {
    return;
  }

  realtimeChannel = db
    .channel("cleoms-chat")
    .on("postgres_changes", { event: "*", schema: "public", table: "users" }, loadRemoteState)
    .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, loadRemoteState)
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, loadRemoteState)
    .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, loadRemoteState)
    .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, loadRemoteState)
    .on("postgres_changes", { event: "*", schema: "public", table: "group_messages" }, loadRemoteState)
    .subscribe();
}

elements.usernameForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!db) {
    showError("Configure Supabase avant de choisir ton nom.");
    return;
  }

  const username = cleanName(elements.usernameInput.value);
  if (!username) {
    return;
  }

  if (state.currentUser && username !== state.currentUser) {
    const renamed = await renameUser(state.currentUser, username);
    if (!renamed) {
      return;
    }

    resetSessionState(username);
    localStorage.setItem(USERNAME_KEY, username);
    render();
    await loadRemoteState();
    return;
  }

  const saved = await saveUser(username);
  if (!saved) {
    return;
  }

  resetSessionState(username);
  localStorage.setItem(USERNAME_KEY, username);
  render();
  await loadRemoteState();
});

elements.addUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!db) {
    showError("Configure Supabase avant d'ajouter un contact.");
    return;
  }

  if (!state.currentUser) {
    showError("Choisis ton nom avant d'ajouter un contact.");
    return;
  }

  const newUser = cleanName(elements.newUserInput.value);
  if (!newUser || newUser === state.currentUser) {
    return;
  }

  const saved = await saveUser(newUser);
  if (!saved) {
    return;
  }

  const contactSaved = await saveContact(newUser);
  if (!contactSaved) {
    return;
  }

  activeChat = { id: newUser, name: newUser, type: "direct" };
  elements.newUserInput.value = "";
  await loadRemoteState();
});

elements.groupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!db) {
    showError("Configure Supabase avant de creer un groupe.");
    return;
  }

  if (!state.currentUser) {
    showError("Choisis ton nom avant de creer un groupe.");
    return;
  }

  const groupName = cleanName(elements.groupNameInput.value, 28);
  const members = elements.groupMembersInput.value
    .split(",")
    .map((member) => cleanName(member))
    .filter(Boolean)
    .filter((member) => member !== state.currentUser);

  if (!groupName || members.length === 0) {
    showError("Ajoute un nom de groupe et au moins un membre.");
    return;
  }

  const group = await createGroup(groupName, members);
  if (!group) {
    return;
  }

  activeChat = { id: group.id, name: group.name, type: "group" };
  elements.groupNameInput.value = "";
  elements.groupMembersInput.value = "";
  await loadRemoteState();
});

elements.messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = elements.messageInput.value.trim();
  if (!db || !content || !state.currentUser || !activeChat) {
    return;
  }

  const request =
    activeChat.type === "group"
      ? db.from("group_messages").insert({
          group_id: activeChat.id,
          sender: state.currentUser,
          content
        })
      : db.from("messages").insert({
          sender: state.currentUser,
          receiver: activeChat.id,
          content
        });

  const { error } = await request;

  if (error) {
    showError(formatSupabaseError("Message non envoye.", error));
    return;
  }

  elements.messageInput.value = "";
  await loadRemoteState();
});

elements.clearChatButton.addEventListener("click", async () => {
  if (!db || !state.currentUser || !activeChat) {
    return;
  }

  const ids = getConversationMessages().map((message) => message.id);
  if (ids.length === 0) {
    return;
  }

  const table = activeChat.type === "group" ? "group_messages" : "messages";
  const { error } = await db.from(table).delete().in("id", ids);

  if (error) {
    showError(formatSupabaseError("Impossible d'effacer cette discussion.", error));
    return;
  }

  await loadRemoteState();
});

subscribeToRealtime();
loadRemoteState();

window.addEventListener("focus", clearUnreadMessages);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    clearUnreadMessages();
  }
});

updateAppHeight();
window.addEventListener("resize", updateAppHeight);
window.visualViewport?.addEventListener("resize", updateAppHeight);
window.visualViewport?.addEventListener("scroll", updateAppHeight);
