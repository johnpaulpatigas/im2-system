// app/api/auth/[...nextauth]/route.ts
import SequelizeAdapter from "@auth/sequelize-adapter";
import NextAuth, { type AuthOptions } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import GoogleProvider from "next-auth/providers/google";
import { DataTypes, Model, Optional, Sequelize } from "sequelize";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    accessToken?: string;
  }
}

const sequelize = new Sequelize(process.env.DATABASE_URL!, {
  logging: false,
  dialect: "mysql",
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  dialectModule: require("mysql2"),
  define: {
    freezeTableName: true,
    timestamps: false,
  },
});

interface UserAttributes extends AdapterUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: Date | null;
  livenessComplete?: boolean;
  faceDescriptor?: number[] | null;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface UserCreationAttributes
  extends Optional<
    UserAttributes,
    | "id"
    | "name"
    | "image"
    | "emailVerified"
    | "livenessComplete"
    | "faceDescriptor"
  > {}

class UserModel extends Model<UserAttributes, UserCreationAttributes> {
  declare id: string;
  declare email: string;
  declare name: string | null;
  declare image: string | null;
  declare emailVerified: Date | null;
  declare livenessComplete: boolean;
  declare faceDescriptor: number[] | null;
}
UserModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING, unique: true },
    emailVerified: { type: DataTypes.DATE },
    image: { type: DataTypes.STRING },
    livenessComplete: { type: DataTypes.BOOLEAN, defaultValue: false },
    faceDescriptor: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  { sequelize, tableName: "nextauth_users" },
);

type AccountTypeString = "oauth" | "email" | "oidc";

interface AccountAttributes {
  id: string;
  userId: string;
  type: AccountTypeString;
  provider: string;
  providerAccountId: string;
  refresh_token?: string;
  access_token?: string;
  expires_at?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
  session_state?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface AccountCreationAttributes
  extends Optional<
    AccountAttributes,
    | "id"
    | "refresh_token"
    | "access_token"
    | "expires_at"
    | "token_type"
    | "scope"
    | "id_token"
    | "session_state"
  > {}

class AccountModel extends Model<AccountAttributes, AccountCreationAttributes> {
  declare id: string;
  declare userId: string;
  declare type: AccountTypeString;
  declare provider: string;
  declare providerAccountId: string;
  declare refresh_token?: string;
  declare access_token?: string;
  declare expires_at?: number;
  declare token_type?: string;
  declare scope?: string;
  declare id_token?: string;
  declare session_state?: string;
}
AccountModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      references: { model: UserModel, key: "id" },
      onDelete: "CASCADE",
    },
    type: { type: DataTypes.STRING },
    provider: { type: DataTypes.STRING },
    providerAccountId: { type: DataTypes.STRING },
    refresh_token: { type: DataTypes.TEXT, allowNull: true },
    access_token: { type: DataTypes.TEXT, allowNull: true },
    expires_at: { type: DataTypes.INTEGER, allowNull: true },
    token_type: { type: DataTypes.STRING, allowNull: true },
    scope: { type: DataTypes.TEXT, allowNull: true },
    id_token: { type: DataTypes.TEXT, allowNull: true },
    session_state: { type: DataTypes.STRING, allowNull: true },
  },
  {
    sequelize,
    tableName: "nextauth_accounts",
    indexes: [{ unique: true, fields: ["provider", "providerAccountId"] }],
  },
);

interface VerificationTokenAttributes {
  id: string;
  identifier: string;
  token: string;
  expires: Date;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface VerificationTokenCreationAttributes
  extends Optional<VerificationTokenAttributes, "id"> {}

class VerificationTokenModel extends Model<
  VerificationTokenAttributes,
  VerificationTokenCreationAttributes
> {
  declare id: string;
  declare identifier: string;
  declare token: string;
  declare expires: Date;
}
VerificationTokenModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    identifier: { type: DataTypes.STRING },
    token: { type: DataTypes.STRING },
    expires: { type: DataTypes.DATE },
  },
  {
    sequelize,
    tableName: "nextauth_verification_tokens",
    indexes: [{ unique: true, fields: ["identifier", "token"] }],
  },
);

UserModel.hasMany(AccountModel, { foreignKey: "userId" });
AccountModel.belongsTo(UserModel, { foreignKey: "userId" });

sequelize
  .sync({ alter: true })
  .then(() => console.log("NextAuth.js database synchronized."))
  .catch((error) => console.error("NextAuth.js database sync error:", error));

const authOptions: AuthOptions = {
  adapter: SequelizeAdapter(sequelize, {
    models: {
      User: UserModel,
      Account: AccountModel,
      VerificationToken: VerificationTokenModel,
    },
  }),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async signIn({ account }) {
      if (account?.provider === "google") return true;
      return false;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { authOptions, handler as GET, handler as POST, UserModel };
