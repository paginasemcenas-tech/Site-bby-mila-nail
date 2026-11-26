import { auth, db } from "../../firebase-config.js";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const normalizePhone = (value) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  return digits;
};

export const customerLoginEmail = async (phone) => {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Este navegador não oferece suporte à autenticação segura.");
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(phone)
  );
  const identifier = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `cliente-${identifier}@login.bby-mila-nails.invalid`;
};

export const loginAliasReference = (kind, identifier) =>
  doc(db, "cliente_login_aliases", `${kind}_${identifier}`);

const saveCustomerProfile = async ({ uid, loginEmail, name, phone, email }) => {
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const profileReference = doc(db, "clientes", uid);
  const emailAlias = normalizedEmail ? loginAliasReference("email", normalizedEmail) : null;
  const alias = emailAlias ? await getDoc(emailAlias) : null;

  if (alias?.exists() && alias.data().uid !== uid) {
    throw new Error("Este e-mail já está associado a uma conta. Acesse “Já sou cliente” para entrar.");
  }

  const profile = {
    nome: String(name || "").trim(),
    telefone: normalizedPhone,
    email: normalizedEmail || null,
    instagram: "",
    loginEmail,
    vipAvisoAte: 0,
    criadoEm: serverTimestamp()
  };
  const batch = writeBatch(db);
  batch.set(profileReference, profile);
  if (emailAlias && !alias.exists()) {
    batch.set(emailAlias, {
      uid,
      kind: "email",
      identifier: normalizedEmail,
      loginEmail
    });
  }
  await batch.commit();
  return profile;
};

export const completeCustomerProfile = async ({ customer, name, phone, email }) => {
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone.length !== 10 && normalizedPhone.length !== 11) {
    throw new Error("Informe um telefone com DDD válido.");
  }

  const expectedLoginEmail = await customerLoginEmail(normalizedPhone);
  if (customer.email !== expectedLoginEmail || auth.currentUser?.uid !== customer.uid) {
    const error = new Error("Esta conta não está vinculada ao telefone informado.");
    error.code = "customer/profile-phone-mismatch";
    throw error;
  }

  const profileReference = doc(db, "clientes", customer.uid);
  const profileSnapshot = await getDoc(profileReference);
  if (profileSnapshot.exists()) return profileSnapshot.data();

  return saveCustomerProfile({
    uid: customer.uid,
    loginEmail: customer.email,
    name,
    phone: normalizedPhone,
    email
  });
};

export const signInCustomer = async (identifier, password) => {
  const normalized = String(identifier || "").trim();
  const isEmail = normalized.includes("@");
  const email = isEmail ? normalized.toLowerCase() : "";
  const phone = isEmail ? "" : normalizePhone(normalized);

  if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Informe um e-mail válido ou telefone com DDD.");
  }
  if (!isEmail && phone.length !== 10 && phone.length !== 11) {
    throw new Error("Informe um e-mail válido ou telefone com DDD.");
  }

  const alias = isEmail
    ? await getDoc(loginAliasReference("email", email))
    : null;
  const loginEmail = isEmail
    ? alias?.exists() ? alias.data().loginEmail : email
    : await customerLoginEmail(phone);
  return signInWithEmailAndPassword(auth, loginEmail, password);
};

export const createCustomerAccount = async ({ name, phone, email, password }) => {
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (normalizedPhone.length !== 10 && normalizedPhone.length !== 11) {
    throw new Error("Informe um telefone com DDD válido.");
  }

  const emailAlias = normalizedEmail ? loginAliasReference("email", normalizedEmail) : null;
  const alias = emailAlias ? await getDoc(emailAlias) : null;
  if (alias?.exists()) {
    throw new Error("Este e-mail já está associado a uma conta. Acesse “Já sou cliente” para entrar.");
  }

  const loginEmail = await customerLoginEmail(normalizedPhone);
  const credential = await createUserWithEmailAndPassword(auth, loginEmail, password);

  try {
    await saveCustomerProfile({
      uid: credential.user.uid,
      loginEmail,
      name,
      phone: normalizedPhone,
      email: normalizedEmail
    });
  } catch (error) {
    try {
      await deleteUser(credential.user);
    } catch (cleanupError) {
      console.error("Não foi possível remover a conta incompleta do Firebase Auth:", cleanupError);
    }
    throw error;
  }

  return credential.user;
};

export const customerAuthError = (error) => {
  if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found") {
    return "Identificador ou senha incorretos. Confira o telefone/e-mail usado no cadastro.";
  }
  if (error.code === "auth/email-already-in-use") {
    return "Este telefone já possui uma conta. Acesse “Já sou cliente” para entrar.";
  }
  if (error.code === "auth/weak-password") {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (error.code === "auth/invalid-email") {
    return "Não foi possível criar o identificador seguro da conta. Confira o telefone e tente novamente.";
  }
  if (error.code === "auth/operation-not-allowed") {
    return "Ative o provedor E-mail/Senha em Firebase Authentication para habilitar o acesso.";
  }
  if (error.code === "auth/too-many-requests") {
    return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  }
  if (error.code === "auth/network-request-failed") {
    return "Sem conexão. Verifique a internet e tente novamente.";
  }
  if (error.code === "permission-denied") {
    return "Não foi possível salvar os dados da conta. Tente novamente e, se o problema continuar, fale com o Studio.";
  }
  return error.message || "Não foi possível concluir. Tente novamente ou fale com o Studio.";
};
