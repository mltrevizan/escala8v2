const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

exports.resetarSenhaServidorAdmin = onCall({ cors: true }, async (request) => {
  // 1. Garante que quem chama está autenticado
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Apenas usuários autenticados podem solicitar o reset de senha."
    );
  }

  const { email } = request.data || {};

  if (!email) {
    throw new HttpsError(
      "invalid-argument",
      "O e-mail do servidor é obrigatório."
    );
  }

  try {
    // 2. Localiza o utilizador pelo e-mail
    const user = await admin.auth().getUserByEmail(email);

    // 3. Redefine a senha no Firebase Auth diretamente para Central123
    await admin.auth().updateUser(user.uid, {
      password: "Central123"
    });

    return {
      success: true,
      message: `Senha do e-mail ${email} alterada com sucesso para Central123 no Firebase Auth.`
    };
  } catch (error) {
    console.error("Erro ao resetar senha no Admin SDK:", error);
    throw new HttpsError(
      "internal",
      `Erro ao redefinir senha no Firebase Auth: ${error.message}`
    );
  }
});
