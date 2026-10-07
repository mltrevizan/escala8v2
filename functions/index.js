const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.resetarSenhaServidorAdmin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Apenas usuários autenticados podem solicitar o reset de senha."
    );
  }

  const { email } = data;

  if (!email) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "O e-mail do servidor é obrigatório."
    );
  }

  try {
    const user = await admin.auth().getUserByEmail(email);

    await admin.auth().updateUser(user.uid, {
      password: "Central123"
    });

    return {
      success: true,
      message: `Senha do e-mail ${email} alterada com sucesso para Central123 no Firebase Auth.`
    };
  } catch (error) {
    console.error("Erro ao resetar senha no Admin SDK:", error);
    throw new functions.https.HttpsError(
      "internal",
      `Erro ao redefinir senha no Firebase Auth: ${error.message}`
    );
  }
});
