interface UserPreferenceIdentity {
  cooperativeId: string;
  userEmail: string;
  key: string;
}

interface GetUserPreferenceInput extends UserPreferenceIdentity {
  defaultValue: unknown;
}

interface SaveUserPreferenceInput extends UserPreferenceIdentity {
  value: unknown;
}

interface UserPreferenceClient {
  userPreference: {
    findUnique: (args: {
      where: {
        cooperativeId_userEmail_key: {
          cooperativeId: string;
          userEmail: string;
          key: string;
        };
      };
    }) => Promise<{ value: unknown } | null>;
    upsert: (args: any) => Promise<unknown>;
  };
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const getStoredUserPreference = async (
  client: UserPreferenceClient,
  { cooperativeId, userEmail, key, defaultValue }: GetUserPreferenceInput,
) => {
  const record = await client.userPreference.findUnique({
    where: {
      cooperativeId_userEmail_key: {
        cooperativeId,
        userEmail: normalizeEmail(userEmail),
        key,
      },
    },
  });

  return record?.value ?? defaultValue;
};

export const saveStoredUserPreference = async (
  client: UserPreferenceClient,
  { cooperativeId, userEmail, key, value }: SaveUserPreferenceInput,
) => {
  await client.userPreference.upsert({
    where: {
      cooperativeId_userEmail_key: {
        cooperativeId,
        userEmail: normalizeEmail(userEmail),
        key,
      },
    },
    create: {
      cooperativeId,
      userEmail: normalizeEmail(userEmail),
      key,
      value,
    },
    update: {
      value,
    },
  });

  return value;
};
