package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type AuthMiddleware struct {
	clientID      string
	allowedDomain string
}

type TokenInfo struct {
	Aud           string `json:"aud"`
	Email         string `json:"email"`
	EmailVerified string `json:"email_verified"`
	Exp           string `json:"exp"`
}

func NewAuthMiddleware(clientID, allowedDomain string) *AuthMiddleware {
	return &AuthMiddleware{
		clientID:      clientID,
		allowedDomain: allowedDomain,
	}
}

func (a *AuthMiddleware) RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip auth if no client ID configured (local dev without auth)
		if a.clientID == "" {
			c.Next()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header format"})
			c.Abort()
			return
		}

		// Verify token with Google's tokeninfo endpoint
		resp, err := http.Get(fmt.Sprintf("https://oauth2.googleapis.com/tokeninfo?id_token=%s", tokenString))
		if err != nil || resp.StatusCode != http.StatusOK {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			c.Abort()
			return
		}
		defer resp.Body.Close()

		var tokenInfo TokenInfo
		if err := json.NewDecoder(resp.Body).Decode(&tokenInfo); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "failed to decode token"})
			c.Abort()
			return
		}

		// Verify audience matches our client ID
		if tokenInfo.Aud != a.clientID {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token audience"})
			c.Abort()
			return
		}

		// Check domain if configured
		if a.allowedDomain != "" {
			if !strings.HasSuffix(tokenInfo.Email, "@"+a.allowedDomain) {
				c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized domain"})
				c.Abort()
				return
			}
		}

		c.Set("email", tokenInfo.Email)
		c.Next()
	}
}
