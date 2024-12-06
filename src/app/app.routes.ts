import { Routes } from '@angular/router';

import {
  AuthJwtGuardService,
  AuthJwtAdminGuardService,
} from '@myrmidon/auth-jwt-login';

import { CorporaComponent } from './corpora/corpora.component';
import { DocumentsComponent } from './documents/documents.component';
import { HomeComponent } from './home/home.component';
import { LoginPageComponent } from './login-page/login-page.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { WordsPageComponent } from './words-page/words-page.component';
import { RegisterUserPageComponent } from './register-user-page/register-user-page.component';
import { ManageUsersPageComponent } from './manage-users-page/manage-users-page.component';
import { SearchPageComponent } from './search-page/search-page.component';

export const routes: Routes = [
  { path: 'home', component: HomeComponent },
  { path: 'login', component: LoginPageComponent },
  {
    path: 'reset-password',
    component: ResetPasswordComponent,
    canActivate: [AuthJwtGuardService],
  },
  {
    path: 'register-user',
    component: RegisterUserPageComponent,
    canActivate: [AuthJwtAdminGuardService],
  },
  {
    path: 'manage-users',
    component: ManageUsersPageComponent,
    canActivate: [AuthJwtAdminGuardService],
  },
  {
    path: 'documents',
    component: DocumentsComponent,
    canActivate: [AuthJwtGuardService],
  },
  {
    path: 'corpora',
    component: CorporaComponent,
    canActivate: [AuthJwtGuardService],
  },
  {
    path: 'words',
    component: WordsPageComponent,
    canActivate: [AuthJwtGuardService],
  },
  {
    path: 'search/:term',
    component: SearchPageComponent,
    canActivate: [AuthJwtGuardService],
  },
  {
    path: 'search',
    component: SearchPageComponent,
    canActivate: [AuthJwtGuardService],
  },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
];
