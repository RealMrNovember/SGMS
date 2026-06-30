import { apiError } from '@/lib/api/response';
import { detectLocale } from '@/i18n/detect-locale';

const API_ERRORS = {
  tr: {
    unauthorized: 'Kimlik doğrulama gerekli.',
    forbidden: 'Bu işlem için yetkiniz yok.',
    notFound: 'Kayıt bulunamadı.',
    invalidJson: 'Geçersiz JSON gövdesi.',
    invalidInput: 'Geçersiz istek verisi.',
    memberNotFound: 'Üye bulunamadı.',
    writeBlocked: 'Salon lisansı veya abonelik nedeniyle yazma işlemi engellendi.',
    invalidToken: 'Geçersiz veya süresi dolmuş API token.',
    invalidTokenUser: 'API token kullanıcısı geçersiz.',
    athleteTokenMissing: 'Sporcu token kaydı eksik.',
    invalidStaffToken: 'Personel token yetkisi geçersiz.',
    superAdminNoTenantApi: 'Super Admin tenant API uçlarına erişemez.',
    noActiveProfile: 'Aktif tenant veya sporcu profili bulunamadı.',
    staffOnlyApi: 'Bu API yalnızca personel erişimine açıktır.',
    athleteOnlyApi: 'Bu API yalnızca sporcu erişimine açıktır.',
    ownRecordsOnly: 'Yalnızca kendi kayıtlarınıza erişebilirsiniz.',
    athleteProfileNotFound: 'Sporcu profili bulunamadı.',
    orgMembershipNotFound: 'Organizasyon üyeliği bulunamadı.',
    invalidCredentials: 'E-posta veya parola hatalı.',
    emailPasswordRequired: 'email ve password zorunludur.',
    noApiScope: 'Bu hesap için uygun API kapsamı bulunamadı.',
    orgMismatch: 'Hesap organizasyon eşleşmesi tutarsız.',
    bearerRequired: 'Authorization: Bearer token gerekli.',
    tokenRevokeNotFound: 'Token bulunamadı veya zaten iptal edilmiş.',
    receiverContentRequired: 'receiverId ve content zorunludur.',
    cannotMessageSelf: 'Kendinize mesaj gönderemezsiniz.',
    receiverNotInOrg: 'Alıcı bu organizasyonda bulunamadı.',
    createMemberRoleRequired: 'Üye oluşturmak için OWNER, ADMIN veya STAFF rolü gerekir.',
    firstNameLastNameRequired: 'firstName ve lastName zorunludur.',
    updateMemberRoleRequired: 'Üye güncellemek için OWNER, ADMIN veya STAFF rolü gerekir.',
    deleteMemberRoleRequired: 'Üye silmek için OWNER, ADMIN veya STAFF rolü gerekir.',
    healthAccessDenied: 'Sağlık ölçümlerine erişim yetkiniz yok.',
    measurementNotFound: 'Ölçüm bulunamadı.',
    updateMeasurementForbidden: 'Ölçüm güncellemek için yetkiniz yok.',
    deleteMeasurementForbidden: 'Ölçüm silmek yalnızca personel içindir.',
    gymMemberIdRequired: 'gymMemberId zorunludur.',
    athleteNotInOrg: 'Sporcu bu organizasyonda bulunamadı.',
    programNotFound: 'Program bulunamadı.',
    ownProgramsOnly: 'Yalnızca kendi programlarınıza erişebilirsiniz.',
    programAccessDenied: 'Bu programa erişim yetkiniz yok.',
    assignProgramRoleRequired: 'Program atamak için TRAINER, ADMIN veya OWNER rolü gerekir.',
    programFieldsRequired: 'gymMemberId, title ve type (WORKOUT|NUTRITION) zorunludur.',
    trainerNotValid: 'Atanan antrenör bu organizasyonda geçerli değil.',
    addExpenseRoleRequired: 'Borç eklemek için OWNER, ADMIN veya STAFF rolü gerekir.',
    expenseFieldsRequired: 'gymMemberId ve pozitif amount zorunludur.',
    categoryNotFound: 'Kategori bulunamadı.',
    recordPaymentRoleRequired: 'Tahsilat kaydetmek için OWNER, ADMIN veya STAFF rolü gerekir.',
    paymentMethodInvalid: 'paymentMethod: CASH, CARD veya TRANSFER olmalıdır.',
    voidExpenseRoleRequired: 'Borç iptali için OWNER veya ADMIN yetkisi gerekir.',
    openExpenseNotFound: 'Açık borç kaydı bulunamadı.',
    unsupportedExpenseUpdate: 'Desteklenmeyen güncelleme. status=VOID kullanın.',
    programUpdateRoleRequired: 'Program güncellemek için TRAINER, ADMIN veya OWNER rolü gerekir.',
    programDeleteForbidden: 'Program silmek yalnızca personel içindir.',
    programDeleteRoleRequired: 'Program silmek için TRAINER, ADMIN veya OWNER rolü gerekir.',
    ownProgramsUpdateOnly: 'Yalnızca kendi programlarınızı güncelleyebilirsiniz.',
    ownProgramsDeleteOnly: 'Yalnızca kendi programlarınızı silebilirsiniz.',
    userNotFound: 'Kullanıcı bulunamadı.',
    memberRecordNotFound: 'Üye kaydı bulunamadı veya bu organizasyona ait değil.',
    avatarUpdateForbidden: 'Bu üyenin avatarını güncelleme yetkiniz yok.',
    invalidMultipart: 'Geçersiz multipart form verisi.',
    fileRequired: 'file alanı zorunludur.',
    avatarStaffOnly: 'Başka bir kullanıcının avatarını yalnızca OWNER, ADMIN veya STAFF güncelleyebilir.',
    avatarUploadForbidden: 'Avatar yükleme yetkiniz yok.',
    roleForbidden: 'Bu işlem için rol yetkiniz yok.',
  },
  en: {
    unauthorized: 'Authentication required.',
    forbidden: 'You do not have permission for this action.',
    notFound: 'Record not found.',
    invalidJson: 'Invalid JSON body.',
    invalidInput: 'Invalid request data.',
    memberNotFound: 'Member not found.',
    writeBlocked: 'Write operations are blocked due to license or subscription.',
    invalidToken: 'Invalid or expired API token.',
    invalidTokenUser: 'API token user is invalid.',
    athleteTokenMissing: 'Athlete token record is incomplete.',
    invalidStaffToken: 'Staff token authorization is invalid.',
    superAdminNoTenantApi: 'Super Admin cannot access tenant API endpoints.',
    noActiveProfile: 'No active tenant or athlete profile found.',
    staffOnlyApi: 'This API is staff-only.',
    athleteOnlyApi: 'This API is athlete-only.',
    ownRecordsOnly: 'You can only access your own records.',
    athleteProfileNotFound: 'Athlete profile not found.',
    orgMembershipNotFound: 'Organization membership not found.',
    invalidCredentials: 'Invalid email or password.',
    emailPasswordRequired: 'email and password are required.',
    noApiScope: 'No suitable API scope for this account.',
    orgMismatch: 'Account organization mapping is inconsistent.',
    bearerRequired: 'Authorization: Bearer token required.',
    tokenRevokeNotFound: 'Token not found or already revoked.',
    receiverContentRequired: 'receiverId and content are required.',
    cannotMessageSelf: 'You cannot message yourself.',
    receiverNotInOrg: 'Recipient not found in this organization.',
    createMemberRoleRequired: 'OWNER, ADMIN or STAFF role required to create members.',
    firstNameLastNameRequired: 'firstName and lastName are required.',
    updateMemberRoleRequired: 'OWNER, ADMIN or STAFF role required to update members.',
    deleteMemberRoleRequired: 'OWNER, ADMIN or STAFF role required to delete members.',
    healthAccessDenied: 'No permission to access health measurements.',
    measurementNotFound: 'Measurement not found.',
    updateMeasurementForbidden: 'No permission to update measurements.',
    deleteMeasurementForbidden: 'Deleting measurements is staff-only.',
    gymMemberIdRequired: 'gymMemberId is required.',
    athleteNotInOrg: 'Athlete not found in this organization.',
    programNotFound: 'Program not found.',
    ownProgramsOnly: 'You can only access your own programs.',
    programAccessDenied: 'No access to this program.',
    assignProgramRoleRequired: 'TRAINER, ADMIN or OWNER role required to assign programs.',
    programFieldsRequired: 'gymMemberId, title and type (WORKOUT|NUTRITION) are required.',
    trainerNotValid: 'Assigned trainer is not valid in this organization.',
    addExpenseRoleRequired: 'OWNER, ADMIN or STAFF role required to add charges.',
    expenseFieldsRequired: 'gymMemberId and positive amount are required.',
    categoryNotFound: 'Category not found.',
    recordPaymentRoleRequired: 'OWNER, ADMIN or STAFF role required to record payments.',
    paymentMethodInvalid: 'paymentMethod must be CASH, CARD or TRANSFER.',
    voidExpenseRoleRequired: 'OWNER or ADMIN required to void charges.',
    openExpenseNotFound: 'Open charge record not found.',
    unsupportedExpenseUpdate: 'Unsupported update. Use status=VOID.',
    programUpdateRoleRequired: 'TRAINER, ADMIN or OWNER role required to update programs.',
    programDeleteForbidden: 'Deleting programs is staff-only.',
    programDeleteRoleRequired: 'TRAINER, ADMIN or OWNER role required to delete programs.',
    ownProgramsUpdateOnly: 'You can only update your own programs.',
    ownProgramsDeleteOnly: 'You can only delete your own programs.',
    userNotFound: 'User not found.',
    memberRecordNotFound: 'Member record not found or not in this organization.',
    avatarUpdateForbidden: 'No permission to update this member avatar.',
    invalidMultipart: 'Invalid multipart form data.',
    fileRequired: 'file field is required.',
    avatarStaffOnly: 'Only OWNER, ADMIN or STAFF can update another user avatar.',
    avatarUploadForbidden: 'Avatar upload not permitted.',
    roleForbidden: 'Your role cannot perform this action.',
  },
} as const;

type BaseLocale = keyof typeof API_ERRORS;
export type ApiErrorKey = keyof (typeof API_ERRORS)['tr'];

const FALLBACK_LOCALES: BaseLocale[] = ['en', 'tr'];

function messageFor(locale: string, key: ApiErrorKey) {
  const table = API_ERRORS[locale as BaseLocale];
  if (table?.[key]) {
    return table[key];
  }
  for (const fallback of FALLBACK_LOCALES) {
    const msg = API_ERRORS[fallback][key];
    if (msg) {
      return msg;
    }
  }
  return key;
}

export function resolveApiLocale(request?: Request) {
  if (!request) {
    return 'tr';
  }
  return detectLocale(request.headers.get('accept-language'));
}

export function apiErrorI18n(
  key: ApiErrorKey,
  status: number,
  request?: Request,
  details?: unknown,
) {
  const locale = resolveApiLocale(request);
  return apiError(messageFor(locale, key), status, details);
}

export function apiErrorI18nForLocale(
  key: ApiErrorKey,
  status: number,
  locale: string,
  details?: unknown,
) {
  return apiError(messageFor(locale, key), status, details);
}
